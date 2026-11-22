-- ============================================================================
-- UNIVERSITY CAMPUS LOST & FOUND INTELLIGENCE SYSTEM
-- SEED DATA: REALISTIC UNIVERSITY DATASET FOR DEMO & TESTING
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. USERS
-- Passwords:
-- admin@campus.edu     -> Admin@123
-- staff@campus.edu     -> Staff@123
-- student1@campus.edu  -> Student@123
-- student2@campus.edu  -> Student@123
-- ----------------------------------------------------------------------------
INSERT INTO users (id, email, password_hash, full_name, role, phone, department, is_active) VALUES
(1, 'admin@campus.edu', '$2b$12$Ngqel7iygIUSqAxm6ZKdZ.e06hMJMyODM/pE2aVjD3idFTkxOIMGO', 'Prof. David Vance', 'admin', '+1-555-0100', 'Campus Administration', TRUE),
(2, 'staff@campus.edu', '$2b$12$2MUwfs6fRFocmg1p4F42RupTyewWN2AW.OXXgnnqwxUdvQCi.pzNC', 'Sarah Jenkins', 'staff', '+1-555-0101', 'Student Affairs / Lost & Found Room', TRUE),
(3, 'student1@campus.edu', '$2b$12$boqL8wym/dcAI0whyOdz2O2Wa41BfQ5.1/GHSZgwV/lBA17KEU2fy', 'Alex Rivera', 'student', '+1-555-0102', 'Computer Science & Engineering', TRUE),
(4, 'student2@campus.edu', '$2b$12$boqL8wym/dcAI0whyOdz2O2Wa41BfQ5.1/GHSZgwV/lBA17KEU2fy', 'Priya Sharma', 'student', '+1-555-0103', 'Electronics & Comm Engineering', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));

-- ----------------------------------------------------------------------------
-- 2. CATEGORIES
-- ----------------------------------------------------------------------------
INSERT INTO categories (id, name, description, icon_name) VALUES
(1, 'Electronics', 'Laptops, tablets, chargers, headphones, calculators, hard drives', 'laptop'),
(2, 'Bags & Backpacks', 'Backpacks, totes, sling bags, laptop sleeves, gym duffels', 'backpack'),
(3, 'Wallets & IDs', 'Wallets, student IDs, bank cards, driver licenses, passport holders', 'wallet'),
(4, 'Keys', 'Dorm keys, bike locks, vehicle keys, lanyards with keyrings', 'key'),
(5, 'Books & Notebooks', 'Textbooks, lab journals, spiral notebooks, binders, course readers', 'book'),
(6, 'Clothing & Accessories', 'Jackets, hoodies, caps, umbrellas, glasses, wristwatches', 'shirt'),
(7, 'Water Bottles', 'Flasks, thermos mugs, stainless steel bottles', 'cup-water'),
(8, 'Other', 'Items not fitting cleanly in designated standard categories', 'package')
ON CONFLICT (id) DO NOTHING;

SELECT setval('categories_id_seq', (SELECT MAX(id) FROM categories));

-- ----------------------------------------------------------------------------
-- 3. CAMPUS LOCATIONS
-- ----------------------------------------------------------------------------
INSERT INTO campus_locations (id, name, zone, building, floor, description) VALUES
(1, 'Central Library 2nd Floor', 'Academic', 'Main Library', '2nd Floor', 'Quiet reading hall and reference section desks'),
(2, 'CS Lab 304', 'Academic', 'Turing Engineering Block', '3rd Floor', 'Computer Science practical laboratory and workstation area'),
(3, 'Main Campus Cafeteria', 'Dining', 'Student Activity Centre', 'Ground Floor', 'Central dining hall, food counters, and seating areas'),
(4, 'Sports Pavilion Gym', 'Sports', 'Recreation Complex', 'Ground Floor', 'Fitness centre, locker rooms, and spectator bleachers'),
(5, 'Lecture Hall Complex 101', 'Academic', 'Lecture Block North', '1st Floor', 'Large tiered auditorium for foundation lectures'),
(6, 'Hostel Block A Lounge', 'Residential', 'Men Residence A', 'Common Lounge', 'Student common room with study tables and recreation area'),
(7, 'Student Health Centre', 'Services', 'Administrative Building', '1st Floor', 'Waiting area and dispensary reception')
ON CONFLICT (id) DO NOTHING;

SELECT setval('campus_locations_id_seq', (SELECT MAX(id) FROM campus_locations));

-- ----------------------------------------------------------------------------
-- 4. LOST ITEM REPORTS
-- ----------------------------------------------------------------------------
INSERT INTO lost_items (id, user_id, category_id, location_id, approximate_location, item_description, distinctive_details, brand, primary_color, secondary_color, lost_date_time, lost_time_range, status) VALUES
(1, 3, 1, 1, 'Central Library, table near window east side', 'Grey Dell XPS 15 laptop with carbon fiber palm rest', 'Sticker of GitHub Octocat on top lid, tiny scratch on bottom left bezel', 'Dell', 'Grey', 'Black', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Morning (10am-12pm)', 'open'),
(2, 3, 3, 3, 'Cafeteria cashier table or tray drop zone', 'Brown leather bifold wallet containing university student ID card', 'Alex Rivera name printed on student card, contains metro card and blue gym pass', 'Fossil', 'Brown', 'Tan', CURRENT_TIMESTAMP - INTERVAL '2 days', 'Lunchtime (1pm-2pm)', 'claim_pending'),
(3, 4, 1, 2, 'CS Lab 304, Desk 18', 'Black Sony WH-1000XM4 noise cancelling wireless headphones', 'Small piece of silver reflective tape on left ear cup hinge', 'Sony', 'Black', 'Silver', CURRENT_TIMESTAMP - INTERVAL '1 day', 'Afternoon (3pm-5pm)', 'open'),
(4, 4, 2, 5, 'Lecture Hall 101, Row F seat 12', 'Blue The North Face Borealis backpack with padded laptop sleeve', 'Attached green carabiner on right strap and enamel NASA pin on front pocket', 'The North Face', 'Blue', 'Black', CURRENT_TIMESTAMP - INTERVAL '4 days', 'Morning (9am-10am)', 'resolved')
ON CONFLICT (id) DO NOTHING;

SELECT setval('lost_items_id_seq', (SELECT MAX(id) FROM lost_items));

-- ----------------------------------------------------------------------------
-- 5. FOUND ITEMS (In official custody of Lost & Found Room)
-- ----------------------------------------------------------------------------
INSERT INTO found_items (id, recorded_by_staff_id, category_id, location_id, found_location_description, item_description, distinctive_details, brand, primary_color, secondary_color, found_date_time, physical_custody_confirmed, storage_location, finder_name, finder_contact, status) VALUES
(1, 2, 1, 1, 'Library 2nd Floor study desk #42', 'Silver/Grey Dell laptop left plugged into wall charger', 'Laptop lid has developer octocat sticker, charger included', 'Dell', 'Grey', 'Black', CURRENT_TIMESTAMP - INTERVAL '3 days' + INTERVAL '2 hours', TRUE, 'Locker Bin A-12', 'Library Security Guard Raman', 'raman@campus.edu', 'in_custody'),
(2, 2, 3, 3, 'Found on cafeteria table 7 near beverage dispenser', 'Men brown leather bifold wallet with student ID and transit cards', 'Student ID visible through clear window, cash and bank card intact', 'Fossil', 'Brown', 'Tan', CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '1 hour', TRUE, 'Safe Box S-04', 'Cafeteria Staff Maria', 'maria.cafe@campus.edu', 'claim_pending'),
(3, 2, 1, 2, 'Bench outside CS Lab 304', 'Black over-ear wireless headphones in black zippered case', 'Left hinge has custom tape marking', 'Sony', 'Black', 'Silver', CURRENT_TIMESTAMP - INTERVAL '18 hours', TRUE, 'Locker Bin B-07', 'Student TA Kevin', 'kevin.ta@campus.edu', 'in_custody'),
(4, 2, 2, 5, 'Lecture Hall 101 front podium', 'Navy blue backpack with notebook and water bottle inside', 'Carabiner attached, space pin on front zipper', 'The North Face', 'Blue', 'Black', CURRENT_TIMESTAMP - INTERVAL '4 days' + INTERVAL '3 hours', TRUE, 'Storage Rack R-02', 'Janitorial Staff Sunita', 'sunita@campus.edu', 'returned')
ON CONFLICT (id) DO NOTHING;

SELECT setval('found_items_id_seq', (SELECT MAX(id) FROM found_items));

-- ----------------------------------------------------------------------------
-- 6. MATCH CANDIDATES
-- ----------------------------------------------------------------------------
INSERT INTO match_candidates (id, lost_item_id, found_item_id, match_score, semantic_score, structured_score, keyword_score, match_reasons, staff_review_status, staff_notes, reviewed_by_staff_id, reviewed_at) VALUES
(1, 1, 1, 94.50, 96.00, 92.50, 95.00, '{"category_match": 1.0, "brand_match": 1.0, "location_proximity": "Same Building (Library)", "time_diff_hours": 2.0, "keyword_overlap": ["dell", "grey", "laptop", "octocat", "sticker"]}', 'relevant', 'High confidence match. Octocat sticker reported on both reports.', 2, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 2, 2, 96.00, 95.00, 98.00, 95.00, '{"category_match": 1.0, "brand_match": 1.0, "location_proximity": "Same Room (Cafeteria)", "time_diff_hours": 1.0, "keyword_overlap": ["fossil", "brown", "wallet", "student", "id"]}', 'relevant', 'Matches student ID and location.', 2, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(3, 3, 3, 91.20, 93.00, 89.00, 91.50, '{"category_match": 1.0, "brand_match": 1.0, "location_proximity": "CS Lab 304 Corridor", "time_diff_hours": 6.0, "keyword_overlap": ["sony", "black", "headphones", "wireless", "hinge"]}', 'unreviewed', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval('match_candidates_id_seq', (SELECT MAX(id) FROM match_candidates));

-- ----------------------------------------------------------------------------
-- 7. CLAIMS
-- ----------------------------------------------------------------------------
INSERT INTO claims (id, found_item_id, claimant_user_id, lost_item_id, claim_description, proof_evidence_notes, distinctive_proof, status, staff_reviewer_id, staff_decision_notes, reviewed_at) VALUES
(1, 4, 4, 4, 'This is my North Face backpack left after CSC201 lecture.', 'Student ID matches name on assignment sheet inside bag.', 'The green carabiner has a small key to my bike lock attached to it.', 'approved', 2, 'Verified student identity and assignment folder inside bag. Approved for collection.', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(2, 2, 3, 2, 'My lost brown Fossil wallet from the cafeteria.', 'Contains my student ID card Alex Rivera #98231 and blue transit pass.', 'Inside right billfold has a 2 dollar good luck bill.', 'submitted', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

SELECT setval('claims_id_seq', (SELECT MAX(id) FROM claims));

-- ----------------------------------------------------------------------------
-- 8. HANDOVERS (Resolved Cases)
-- ----------------------------------------------------------------------------
INSERT INTO handovers (id, claim_id, found_item_id, recipient_user_id, staff_id, handover_date_time, recipient_id_type, recipient_id_number, handover_notes, recipient_signature_acknowledged) VALUES
(1, 1, 4, 4, 2, CURRENT_TIMESTAMP - INTERVAL '2 days', 'Student ID Card', 'STU-2023-EC-8834', 'Physically handed over to Priya Sharma after checking student card and verifying contents.', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval('handovers_id_seq', (SELECT MAX(id) FROM handovers));

-- ----------------------------------------------------------------------------
-- 9. NOTIFICATIONS
-- ----------------------------------------------------------------------------
INSERT INTO notifications (user_id, title, message, notification_type, is_read, reference_entity, reference_id) VALUES
(3, 'Potential Match Discovered', 'A found item matching your Dell XPS 15 has been recorded by staff at the Central Library.', 'match_found', FALSE, 'match_candidates', 1),
(3, 'Claim Under Review', 'Your ownership claim on the Fossil brown wallet has been submitted and is in the staff review queue.', 'claim_update', FALSE, 'claims', 2),
(4, 'Item Handover Complete', 'Your The North Face backpack was returned to you. The report has been closed as resolved.', 'handover_ready', TRUE, 'handovers', 1);

-- ----------------------------------------------------------------------------
-- 10. STATUS HISTORY & AUDIT LOGS
-- ----------------------------------------------------------------------------
INSERT INTO status_history (entity_type, entity_id, old_status, new_status, changed_by_user_id, change_reason) VALUES
('found_item', 4, 'in_custody', 'awaiting_handover', 2, 'Claim #1 approved by staff'),
('found_item', 4, 'awaiting_handover', 'returned', 2, 'Handover #1 completed and signed'),
('lost_item', 4, 'open', 'resolved', 2, 'Associated found item returned to owner');

INSERT INTO audit_logs (table_name, record_id, action, old_values, new_values, changed_by_user_id, ip_address) VALUES
('handovers', 1, 'INSERT', NULL, '{"claim_id": 1, "found_item_id": 4, "recipient": "Priya Sharma"}', 2, '127.0.0.1');

