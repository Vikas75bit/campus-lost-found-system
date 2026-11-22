# University Lost & Found Intelligence System - User Guide
## Step-by-Step Operational Manual for Students, Staff & Administrators

### 1. Getting Started & Fast Role Switching

The system includes a top **Academic Evaluation Quick Switcher** banner allowing evaluators to instantly switch between all campus roles with a single click:

- **👨‍🎓 Student 1 (Alex Rivera):** `student1@campus.edu` / `Student@123`
- **👩‍🎓 Student 2 (Priya Sharma):** `student2@campus.edu` / `Student@123`
- **🛡️ Staff Officer (Sarah Jenkins):** `staff@campus.edu` / `Staff@123`
- **🏛️ Admin (Prof. David Vance):** `admin@campus.edu` / `Admin@123`

---

### 2. Student / Campus User Workflow

#### 2.1 Submitting a Lost-Item Report
1. Click the **👨‍🎓 Student 1** button in the top banner.
2. Ensure you are on the **My Lost Reports** tab.
3. Click the blue **+ Report Lost Item** button.
4. Fill in the required fields:
   - **Category:** Select from the dropdown (e.g., *Electronics*).
   - **Description:** Provide a meaningful description (e.g., *Apple iPad Air with blue silicone sleeve*).
   - **Location:** Enter approximate last-known area (e.g., *Central Library 2nd floor*).
   - **Date Lost:** Select the approximate date and time window.
5. Review the **Distinctive Details Prompt Box**:
   - Provide any specific marks (e.g., *Small scratch on volume rocker, sticker on back*). If you do not recall, leave it blank (it is optional).
6. Click **Submit Lost Report**.
7. The system registers the report with status `open` and immediately scans for potential matches in background.

#### 2.2 Browsing Found Items & Submitting an Ownership Claim
1. Click the **Browse Found Items** tab.
2. Note that all items listed are officially in university custody. Internal storage locker codes and finder contacts are automatically masked for privacy.
3. If an item matches your lost belonging, click **Claim Item**.
4. Fill in:
   - **Statement of Ownership:** Describe how and where you lost it.
   - **Verifiable Evidence:** Provide purchase receipts, serial numbers, or device unlock details.
   - **Confidential Distinctive Proof:** Enter private identifying marks visible only to staff officers.
5. Click **Submit Claim for Review**. Target item status updates to `claim_pending`.

#### 2.3 Tracking Status & In-App Notifications
1. View the **Suggested Matches** tab to inspect system-ranked suggestions.
2. View the **My Claims** tab to check staff review decisions.
3. Check the **🔔 Notification Bell** in the top right to see real-time updates when staff review your claim.

---

### 3. Lost-and-Found Staff Workflow

#### 3.1 Recording a Found Item into Custody
1. Click the **🛡️ Staff Officer** button in the top banner.
2. Go to the **Found Items Custody** tab.
3. Click **+ Record Found Item into Custody**.
4. Enter the **Physical Custody Storage Location** (mandatory e.g., `Room 104, Locker Bin B-07`).
5. Fill in category, description, found location, date, and observed characteristics.
6. Click **Record Official Custody**. The item is saved with status `in_custody`.

#### 3.2 Operating the Candidate Match Cockpit
1. Switch to the **Match Cockpit** tab.
2. Review candidate lost/found pairs sorted by descending **Match Score**.
3. Inspect the signal breakdown: **Semantic Similarity**, **Keyword Overlap**, and **Structured Compatibility**.
4. Click **Review Candidate** to assign a staff status:
   - `Relevant`: High likelihood match; alerts claimant.
   - `Investigating`: Staff physically checking the locker bin.
   - `Rejected`: Distinct items with coincidental vocabulary.
5. Enter investigative notes and save.

#### 3.3 Evaluating Ownership Claims
1. Switch to the **Claims Verification Queue** tab.
2. Inspect pending claims, comparing claimant statements and confidential proof against the physical item.
3. Click **Assess Claim**:
   - **Approve Claim:** Transitions found item to `awaiting_handover` (Item is ready for pickup; **NOT returned yet**).
   - **Request Additional Evidence:** Notifies student to bring specific proof.
   - **Reject Claim:** Reverts item to `in_custody` if no other claims exist.
4. Enter mandatory reasoning notes and click **Record Decision**.

#### 3.4 Executing the Physical Handover & Resolving the Case
1. Switch to the **Physical Handover Desk** tab.
2. Approved claims awaiting physical collection appear in the top table.
3. When the student arrives in the lost-and-found room:
   - Inspect their photo identification document.
4. Click **Record Physical Handover**:
   - Select **Recipient ID Document Type** (e.g., *University Student ID Card*).
   - Enter the **Recipient ID Number** (e.g., *STU-2023-CS-98231*).
   - Enter handover notes confirming physical receipt in the register.
5. Click **Complete Handover & Resolve Case**.
6. **Result:** The found item transitions to `returned`, and the associated lost report transitions to `resolved`. The case is officially closed and archived in the immutable handover register.

---

### 4. System Administrator Workflow

#### 4.1 Overview & Statistics
1. Click the **🏛️ Admin** button in the top banner.
2. View real-time operational stat cards:
   - Total Lost Reports (Open vs Resolved).
   - Found Items in Custody (In Custody vs Awaiting Handover vs Returned).
   - Total Claims and Completed Handovers.

#### 4.2 User & Role Management
1. Scroll to the **User Account & Role Management** table.
2. Change user roles dynamically using the dropdown (`student`, `staff`, `admin`).
3. Toggle accounts between `Active` and `Disabled`.

#### 4.3 Running the Live AI Benchmark Evaluator
1. Switch to the **AI Benchmark Evaluator** tab.
2. Click **🚀 Run Live Benchmark**.
3. Inspect live empirical measurements of **Precision@1**, **Precision@3**, **Recall@1**, **Recall@3**, **MRR**, and **Latency (ms)** comparing the Baseline Matcher, Semantic Dense Vector Matcher, and the Hybrid Multi-Signal Matcher.

#### 4.4 Reviewing DBMS Audit Logs
1. Switch to the **DBMS Audit Logs** tab.
2. Inspect the **Entity Status Transition History** table displaying every status change across the lifecycle.
3. Inspect the **Relational Database Audit Logs** table tracking raw table modifications, user IDs, and timestamps.

