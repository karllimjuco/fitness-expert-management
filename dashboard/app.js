// Shared logic for all four dashboard pages: authentication guard, logout, persistent daily counters, and monthly plan selection.

(function() {
    // 1. Authentication check: redirect to login if no staff is logged in
    var staffName = sessionStorage.getItem("logged_staff_name");
    if (!staffName) {
        window.location.href = "../loginstaff.html";
        return;
    }

    // 2. Set staff name in header
    var staffNameEl = document.getElementById("staffNameDisplay");
    if (staffNameEl) {
        staffNameEl.textContent = staffName;
    }

    // 3. Logout handler
    var logoutLink = document.getElementById("logoutLink");
    if (logoutLink) {
        logoutLink.addEventListener("click", function(e) {
            e.preventDefault();
            sessionStorage.removeItem("logged_staff_name");
            window.location.href = "../loginstaff.html";
        });
    }

    // 4. Default daily state
    var DEFAULTS = {
        baseRevenue: 3250,
        nonMemberCount: 8,
        memberCount: 6,
        studentPlanCount: 0,
        regularPlanCount: 0
    };

    function loadCounters() {
        var saved = {};
        try {
            saved = JSON.parse(localStorage.getItem("gym_daily_counters")) || {};
        } catch (e) {
            saved = {};
        }
        var data = {};
        for (var key in DEFAULTS) {
            data[key] = typeof saved[key] === "number" ? saved[key] : DEFAULTS[key];
        }
        return data;
    }

    function saveCounters(data) {
        localStorage.setItem("gym_daily_counters", JSON.stringify(data));
    }

    // Undo history: remembers which counter each tap changed, newest last
    function loadHistory() {
        try {
            return JSON.parse(localStorage.getItem("gym_undo_history")) || [];
        } catch (e) {
            return [];
        }
    }

    function saveHistory(list) {
        localStorage.setItem("gym_undo_history", JSON.stringify(list));
    }

    var FIELD_LABELS = {
        nonMemberCount: "Non-Member Day Pass (₱80)",
        memberCount: "Member Day Pass (₱60)",
        studentPlanCount: "Student Plan (₱700)",
        regularPlanCount: "Regular Plan (₱750)"
    };

    function updateUI() {
        var data = loadCounters();
        var passesCount = data.nonMemberCount + data.memberCount;
        var passRevenue = (data.nonMemberCount * 80) + (data.memberCount * 60);
        var planRevenue = (data.studentPlanCount * 700) + (data.regularPlanCount * 750);
        var totalRevenue = data.baseRevenue + passRevenue + planRevenue;

        var revVal = document.getElementById("todayRevenueVal");
        if (revVal) {
            revVal.textContent = "₱ " + totalRevenue.toLocaleString();
        }

        var revNote = document.getElementById("todayRevenueNote");
        if (revNote) {
            revNote.textContent = "Day passes ₱" + passRevenue.toLocaleString() +
                " · Monthly plans ₱" + planRevenue.toLocaleString();
        }

        var passesVal = document.getElementById("guestPassesVal");
        if (passesVal) {
            passesVal.textContent = passesCount;
        }

        var passesNote = document.getElementById("guestPassesNote");
        if (passesNote) {
            passesNote.textContent = data.nonMemberCount + " Non-Members (₱80) · " + data.memberCount + " Members (₱60)";
        }

        var dayTotalPill = document.getElementById("dayTotalPill");
        if (dayTotalPill) {
            dayTotalPill.textContent = "₱ " + totalRevenue.toLocaleString() + ".00";
        }
    }

    // Adds one to a counter field, records it for undo, and refreshes the UI
    function addOne(field) {
        var data = loadCounters();
        data[field] += 1;
        saveCounters(data);

        var history = loadHistory();
        history.push(field);
        saveHistory(history);

        updateUI();
    }

    // Day pass buttons (dashboard.html)
    var btnAddNonMember = document.getElementById("btnAddNonMember");
    if (btnAddNonMember) {
        btnAddNonMember.addEventListener("click", function() {
            addOne("nonMemberCount");
        });
    }

    var btnAddMember = document.getElementById("btnAddMember");
    if (btnAddMember) {
        btnAddMember.addEventListener("click", function() {
            addOne("memberCount");
        });
    }

    // Monthly Plan & Modal Assignment Logic (monthly.html)
    function showPlanMessage(text) {
        var msg = document.getElementById("planMessage");
        if (msg) {
            msg.textContent = text;
        }
    }

    // Initialize default seed members if localStorage is empty
    (function initDefaultMembers() {
        if (!localStorage.getItem("gym_members")) {
            var defaultMembers = [
                { id: "#1024", name: "Faizan Fayyaz", contact: "0917-111-2222", lifetimeMember: true, monthlyPlan: "Student Monthly", planExpiry: "2026-10-03" },
                { id: "#1031", name: "John Lloyd Cruz", contact: "0917-333-4444", lifetimeMember: true, monthlyPlan: "Regular Monthly", planExpiry: "2026-09-28" },
                { id: "#1019", name: "Bea Alonzo", contact: "0917-555-6666", lifetimeMember: true, monthlyPlan: "None", planExpiry: null }
            ];
            localStorage.setItem("gym_members", JSON.stringify(defaultMembers));
        }
    })();

    // Filter eligible lifetime members (must be registered lifetime member with no active plan or an expired plan)
    function isEligibleForMonthlyPlan(member) {
        if (!member.lifetimeMember) return false;
        if (!member.planExpiry || member.monthlyPlan === "None") return true;

        var today = new Date().toISOString().split("T")[0];
        return member.planExpiry < today;
    }

    function openPlanModal(planType, price) {
        var members = JSON.parse(localStorage.getItem("gym_members")) || [];
        var eligibleMembers = members.filter(isEligibleForMonthlyPlan);
        var listEl = document.getElementById("eligibleMembersList");
        var modalTitle = document.getElementById("modalPlanTitle");
        var modal = document.getElementById("planModal");

        if (!listEl || !modal) return;

        modalTitle.textContent = "Assign " + planType + " (₱" + price + ")";
        listEl.innerHTML = "";

        if (eligibleMembers.length === 0) {
            listEl.innerHTML = "<li style='padding:1rem; text-align:center; color:#888;'>No eligible members found. Register new members first in 'Add Member'.</li>";
        } else {
            eligibleMembers.forEach(function(member) {
                var li = document.createElement("li");
                li.className = "member-item-select";
                li.innerHTML = `
                    <div>
                        <strong>${member.name}</strong> <small style="color:#aaa;">(${member.id})</small>
                        <div style="font-size:0.75rem; color:#888;">${member.planExpiry ? "Expired on: " + member.planExpiry : "No Active Monthly Pass"}</div>
                    </div>
                    <button type="button" class="select-btn">Select</button>
                `;

                li.querySelector("button").addEventListener("click", function() {
                    assignMonthlyPass(member.id, planType, price);
                });

                listEl.appendChild(li);
            });
        }

        modal.style.display = "flex";
    }

    function assignMonthlyPass(memberId, planType, price) {
        var members = JSON.parse(localStorage.getItem("gym_members")) || [];
        
        var expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 30);
        var expiryStr = expiryDate.toISOString().split("T")[0];

        for (var i = 0; i < members.length; i++) {
            if (members[i].id === memberId) {
                members[i].monthlyPlan = planType;
                members[i].planExpiry = expiryStr;
                break;
            }
        }

        localStorage.setItem("gym_members", JSON.stringify(members));

        var modal = document.getElementById("planModal");
        if (modal) modal.style.display = "none";

        showPlanMessage("Activated " + planType + " for " + memberId + " (Expires: " + expiryStr + ")");

        if (planType.includes("Student")) {
            addOne("studentPlanCount");
        } else {
            addOne("regularPlanCount");
        }
    }

    // Attach event listeners for plan buttons
    var btnStudentPlan = document.getElementById("btnStudentPlan");
    if (btnStudentPlan) {
        btnStudentPlan.addEventListener("click", function() {
            openPlanModal("Student Plan", 700);
        });
    }

    var btnRegularPlan = document.getElementById("btnRegularPlan");
    if (btnRegularPlan) {
        btnRegularPlan.addEventListener("click", function() {
            openPlanModal("Regular Plan", 750);
        });
    }

    var closeModalBtn = document.getElementById("closeModalBtn");
    if (closeModalBtn) {
        closeModalBtn.addEventListener("click", function() {
            document.getElementById("planModal").style.display = "none";
        });
    }

    // Undo and Reset buttons (all dashboard pages)
    var btnResetDay = document.getElementById("btnResetDay");
    if (btnResetDay) {
        var btnUndo = document.createElement("button");
        btnUndo.type = "button";
        btnUndo.id = "btnUndo";
        btnUndo.className = "reset-btn";
        btnUndo.textContent = "Undo Last";

        var group = document.createElement("div");
        group.style.display = "flex";
        group.style.gap = "0.5rem";
        btnResetDay.parentNode.insertBefore(group, btnResetDay);
        group.appendChild(btnUndo);
        group.appendChild(btnResetDay);

        btnUndo.addEventListener("click", function() {
            var history = loadHistory();
            var revNote = document.getElementById("todayRevenueNote");

            if (history.length === 0) {
                if (revNote) {
                    revNote.textContent = "Nothing to undo";
                }
                return;
            }

            var field = history.pop();
            var data = loadCounters();
            if (data[field] > 0) {
                data[field] -= 1;
            }
            saveCounters(data);
            saveHistory(history);
            updateUI();

            if (revNote) {
                revNote.textContent = "Removed: " + FIELD_LABELS[field];
            }
        });

        btnResetDay.addEventListener("click", function() {
            if (confirm("Are you sure you want to reset today's daily counters to 0?")) {
                var resetData = {};
                for (var key in DEFAULTS) {
                    resetData[key] = 0;
                }
                saveCounters(resetData);
                saveHistory([]);
                updateUI();
                showPlanMessage("");
            }
        });
    }

    // Initial render
    updateUI();
})();