from datetime import datetime, timedelta, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from backend.app.auth import get_password_hash
from backend.app.config import settings
from backend.app.matching.semantic import semantic_engine
from backend.app.models import (
    AuditLog,
    CampusLocation,
    Category,
    Claim,
    FoundItem,
    Handover,
    LostItem,
    MatchCandidate,
    Notification,
    StatusHistory,
    User,
)


def _sync_sequences(db: Session) -> None:
    tables = [
        "users",
        "categories",
        "campus_locations",
        "lost_items",
        "found_items",
        "match_candidates",
        "claims",
        "handovers",
        "notifications",
        "status_history",
        "audit_logs",
    ]
    for tbl in tables:
        db.execute(
            text(
                f"SELECT setval(pg_get_serial_sequence('{tbl}', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM {tbl}), 1), true)"
            )
        )
    db.commit()


def seed_database(db: Session) -> None:
    if db.query(User).count() > 0:
        # Backfill embeddings if any seeded items lack vectors
        missing_lost = db.query(LostItem).filter(LostItem.embedding.is_(None)).all()
        missing_found = db.query(FoundItem).filter(FoundItem.embedding.is_(None)).all()
        if missing_lost or missing_found:
            for item in missing_lost:
                item.embedding = semantic_engine.encode_item(item)
                item.embedding_model = settings.EMBEDDING_MODEL
            for item in missing_found:
                item.embedding = semantic_engine.encode_item(item)
                item.embedding_model = settings.EMBEDDING_MODEL
            db.commit()
        return

    now = datetime.now(timezone.utc)

    # 1. Users
    users = [
        User(id=1, email="admin@campus.edu", password_hash=get_password_hash("Admin@123"), full_name="Prof. David Vance", role="admin", phone="+1-555-0100", department="Campus Administration", is_active=True),
        User(id=2, email="staff@campus.edu", password_hash=get_password_hash("Staff@123"), full_name="Sarah Jenkins", role="staff", phone="+1-555-0101", department="Student Affairs / Lost & Found", is_active=True),
        User(id=3, email="student1@campus.edu", password_hash=get_password_hash("Student@123"), full_name="Alex Rivera", role="student", phone="+1-555-0102", department="Computer Science & Engineering", is_active=True),
        User(id=4, email="student2@campus.edu", password_hash=get_password_hash("Student@123"), full_name="Priya Sharma", role="student", phone="+1-555-0103", department="Electronics Engineering", is_active=True),
    ]
    db.add_all(users)
    db.commit()

    # 2. Categories
    categories = [
        Category(id=1, name="Electronics", description="Laptops, tablets, chargers, headphones, calculators", icon_name="laptop"),
        Category(id=2, name="Bags & Backpacks", description="Backpacks, totes, sling bags, laptop sleeves", icon_name="backpack"),
        Category(id=3, name="Wallets & IDs", description="Wallets, student IDs, bank cards, driver licenses", icon_name="wallet"),
        Category(id=4, name="Keys", description="Dorm keys, bike locks, vehicle keys, lanyards", icon_name="key"),
        Category(id=5, name="Books & Notebooks", description="Textbooks, lab journals, spiral notebooks, binders", icon_name="book"),
        Category(id=6, name="Clothing & Accessories", description="Jackets, hoodies, caps, umbrellas, glasses, watches", icon_name="shirt"),
        Category(id=7, name="Water Bottles", description="Flasks, thermos mugs, stainless steel bottles", icon_name="cup-water"),
        Category(id=8, name="Other", description="General miscellaneous campus items", icon_name="package"),
    ]
    db.add_all(categories)
    db.commit()

    # 3. Campus Locations
    locations = [
        CampusLocation(id=1, name="Central Library 2nd Floor", zone="Academic", building="Main Library", floor="2nd Floor", description="Quiet study desks and reference stacks"),
        CampusLocation(id=2, name="CS Lab 304", zone="Academic", building="Turing Engineering Block", floor="3rd Floor", description="Computer Science terminal workstations"),
        CampusLocation(id=3, name="Main Campus Cafeteria", zone="Dining", building="Student Activity Centre", floor="Ground Floor", description="Dining tables and tray drop counter"),
        CampusLocation(id=4, name="Sports Pavilion Gym", zone="Sports", building="Recreation Complex", floor="Ground Floor", description="Fitness gym and changing lockers"),
        CampusLocation(id=5, name="Lecture Hall Complex 101", zone="Academic", building="Lecture Block North", floor="1st Floor", description="Main auditorium for foundational courses"),
        CampusLocation(id=6, name="Hostel Block A Lounge", zone="Residential", building="Residence Block A", floor="Common Lounge", description="Student lounge and common tables"),
    ]
    db.add_all(locations)
    db.commit()

    # 4. Lost Items with persistent 384-dim pgvector embeddings
    lost_items = [
        LostItem(id=1, user_id=3, category_id=1, location_id=1, approximate_location="Central Library 2nd floor, window desk", item_description="Grey Dell XPS 15 laptop with carbon fiber palm rest", distinctive_details="GitHub Octocat sticker on top lid, tiny scratch on bezel", brand="Dell", primary_color="Grey", secondary_color="Black", lost_date_time=now - timedelta(days=3), lost_time_range="Morning (10am-12pm)", status="open"),
        LostItem(id=2, user_id=3, category_id=3, location_id=3, approximate_location="Cafeteria cashier table or tray return area", item_description="Brown leather bifold wallet with student ID card", distinctive_details="Student ID card Alex Rivera inside, has transit card", brand="Fossil", primary_color="Brown", secondary_color="Tan", lost_date_time=now - timedelta(days=2), lost_time_range="Lunch (1pm-2pm)", status="claim_pending"),
        LostItem(id=3, user_id=4, category_id=1, location_id=2, approximate_location="CS Lab 304, Desk 18", item_description="Black Sony WH-1000XM4 wireless noise cancelling headphones", distinctive_details="Silver reflective tape on left hinge", brand="Sony", primary_color="Black", secondary_color="Silver", lost_date_time=now - timedelta(days=1), lost_time_range="Afternoon (3pm-5pm)", status="open"),
        LostItem(id=4, user_id=4, category_id=2, location_id=5, approximate_location="Lecture Hall 101, Row F seat 12", item_description="Blue The North Face Borealis backpack with padded laptop sleeve", distinctive_details="Attached green carabiner and NASA space pin", brand="The North Face", primary_color="Blue", secondary_color="Black", lost_date_time=now - timedelta(days=4), lost_time_range="Morning (9am-10am)", status="resolved"),
    ]
    for item in lost_items:
        item.embedding = semantic_engine.encode_item(item)
        item.embedding_model = settings.EMBEDDING_MODEL
    db.add_all(lost_items)
    db.commit()

    # 5. Found Items with persistent 384-dim pgvector embeddings
    found_items = [
        FoundItem(id=1, recorded_by_staff_id=2, category_id=1, location_id=1, found_location_description="Library study desk 42", item_description="Silver/Grey Dell laptop left plugged into power socket", distinctive_details="Developer octocat sticker on lid", brand="Dell", primary_color="Grey", secondary_color="Black", found_date_time=now - timedelta(days=3) + timedelta(hours=2), physical_custody_confirmed=True, storage_location="Locker Bin A-12", finder_name="Library Guard Raman", finder_contact="raman@campus.edu", status="in_custody"),
        FoundItem(id=2, recorded_by_staff_id=2, category_id=3, location_id=3, found_location_description="Found on cafeteria table 7", item_description="Men brown leather bifold wallet with student ID and transit cards", distinctive_details="Student ID visible through window", brand="Fossil", primary_color="Brown", secondary_color="Tan", found_date_time=now - timedelta(days=2) + timedelta(hours=1), physical_custody_confirmed=True, storage_location="Safe Box S-04", finder_name="Cafeteria Staff Maria", finder_contact="maria@campus.edu", status="claim_pending"),
        FoundItem(id=3, recorded_by_staff_id=2, category_id=1, location_id=2, found_location_description="Bench outside CS Lab 304", item_description="Black over-ear wireless headphones in black zippered case", distinctive_details="Left hinge has custom tape marking", brand="Sony", primary_color="Black", secondary_color="Silver", found_date_time=now - timedelta(hours=18), physical_custody_confirmed=True, storage_location="Locker Bin B-07", finder_name="TA Kevin", finder_contact="kevin.ta@campus.edu", status="in_custody"),
        FoundItem(id=4, recorded_by_staff_id=2, category_id=2, location_id=5, found_location_description="Lecture Hall 101 front podium", item_description="Navy blue backpack with notebook inside", distinctive_details="Green carabiner attached, NASA pin", brand="The North Face", primary_color="Blue", secondary_color="Black", found_date_time=now - timedelta(days=4) + timedelta(hours=3), physical_custody_confirmed=True, storage_location="Storage Rack R-02", finder_name="Janitor Sunita", finder_contact="sunita@campus.edu", status="returned"),
    ]
    for item in found_items:
        item.embedding = semantic_engine.encode_item(item)
        item.embedding_model = settings.EMBEDDING_MODEL
    db.add_all(found_items)
    db.commit()

    # 6. Match Candidates
    matches = [
        MatchCandidate(id=1, lost_item_id=1, found_item_id=1, match_score=94.50, semantic_score=96.00, structured_score=92.50, keyword_score=95.00, match_reasons='{"disclaimer": "Candidate retrieval similarity score only. Ownership verification requires staff evidence review.", "signals": [{"name": "Category Compatibility", "impact": "Positive", "value": "Exact category match"}, {"name": "Brand Match", "impact": "Positive", "value": "Exact brand: Dell"}, {"name": "Location Exact Match", "impact": "Positive", "value": "Same registered campus location"}, {"name": "Temporal Window", "impact": "Positive", "value": "Found within 2.0 hours of report"}, {"name": "pgvector Cosine Similarity", "impact": "Informational", "value": "96.0% dense vector match"}]}', staff_review_status="relevant", staff_notes="High confidence match. Octocat sticker reported on both reports.", reviewed_by_staff_id=2, reviewed_at=now - timedelta(days=2)),
        MatchCandidate(id=2, lost_item_id=2, found_item_id=2, match_score=96.00, semantic_score=95.00, structured_score=98.00, keyword_score=95.00, match_reasons='{"disclaimer": "Candidate retrieval similarity score only. Ownership verification requires staff evidence review.", "signals": [{"name": "Category Compatibility", "impact": "Positive", "value": "Exact category match"}, {"name": "Brand Match", "impact": "Positive", "value": "Exact brand: Fossil"}, {"name": "Location Exact Match", "impact": "Positive", "value": "Same registered campus location"}, {"name": "Temporal Window", "impact": "Positive", "value": "Found within 1.0 hours of report"}]}', staff_review_status="relevant", staff_notes="Matches student name Alex Rivera.", reviewed_by_staff_id=2, reviewed_at=now - timedelta(days=1)),
        MatchCandidate(id=3, lost_item_id=3, found_item_id=3, match_score=91.20, semantic_score=93.00, structured_score=89.00, keyword_score=91.50, match_reasons='{"disclaimer": "Candidate retrieval similarity score only. Ownership verification requires staff evidence review.", "signals": [{"name": "Category Compatibility", "impact": "Positive", "value": "Exact category match"}, {"name": "Brand Match", "impact": "Positive", "value": "Exact brand: Sony"}, {"name": "Location Proximity", "impact": "Positive", "value": "CS Lab 304 area"}, {"name": "Temporal Window", "impact": "Positive", "value": "Found within 6.0 hours of report"}]}', staff_review_status="unreviewed"),
    ]
    db.add_all(matches)
    db.commit()

    # 7. Claims
    claims = [
        Claim(id=1, found_item_id=4, claimant_user_id=4, lost_item_id=4, claim_description="This is my blue The North Face backpack left after CSC201 class.", proof_evidence_notes="Student ID matches name on assignment sheets inside bag.", distinctive_proof="The green carabiner has a small key to my bike lock attached.", status="approved", staff_reviewer_id=2, staff_decision_notes="Verified student identity and course assignment inside bag. Approved.", reviewed_at=now - timedelta(days=3)),
        Claim(id=2, found_item_id=2, claimant_user_id=3, lost_item_id=2, claim_description="My lost brown Fossil wallet from the cafeteria table.", proof_evidence_notes="Contains my student ID card Alex Rivera #98231 and transit pass.", distinctive_proof="Inside right fold has a folded two dollar bill.", status="submitted"),
    ]
    db.add_all(claims)
    db.commit()

    # 8. Handovers
    handovers = [
        Handover(id=1, claim_id=1, found_item_id=4, recipient_user_id=4, staff_id=2, handover_date_time=now - timedelta(days=2), recipient_id_type="Student ID Card", recipient_id_number="STU-2023-EC-8834", handover_notes="Physically handed over to Priya Sharma after checking student card and verifying contents.", recipient_signature_acknowledged=True),
    ]
    db.add_all(handovers)
    db.commit()

    # 9. Notifications
    notifs = [
        Notification(user_id=3, title="Potential Match Discovered", message="A found item matching your Dell XPS 15 has been recorded by staff at Central Library.", notification_type="match_found", is_read=False, reference_entity="match_candidates", reference_id=1),
        Notification(user_id=3, title="Claim Under Review", message="Your ownership claim on the Fossil wallet is pending staff review.", notification_type="claim_update", is_read=False, reference_entity="claims", reference_id=2),
        Notification(user_id=4, title="Item Handover Complete", message="Your The North Face backpack was returned. Case marked resolved.", notification_type="handover_ready", is_read=True, reference_entity="handovers", reference_id=1),
    ]
    db.add_all(notifs)

    # 10. Status History & Audit Logs
    status_histories = [
        StatusHistory(entity_type="found_item", entity_id=4, old_status="in_custody", new_status="awaiting_handover", changed_by_user_id=2, change_reason="Claim #1 approved by staff"),
        StatusHistory(entity_type="found_item", entity_id=4, old_status="awaiting_handover", new_status="returned", changed_by_user_id=2, change_reason="Handover #1 completed and signed"),
        StatusHistory(entity_type="lost_item", entity_id=4, old_status="open", new_status="resolved", changed_by_user_id=2, change_reason="Associated found item returned to owner"),
    ]
    db.add_all(status_histories)

    audit_logs = [
        AuditLog(table_name="handovers", record_id=1, action="INSERT", new_values='{"claim_id": 1, "found_item_id": 4, "recipient": "Priya Sharma"}', changed_by_user_id=2, ip_address="127.0.0.1"),
    ]
    db.add_all(audit_logs)
    db.commit()

    _sync_sequences(db)
