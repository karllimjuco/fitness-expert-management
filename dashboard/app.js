// Shared logic for all four dashboard pages: authentication guard, logout, and persistent daily counters.

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
    // The base revenue and starting pass counts are placeholder demo numbers.
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
        // Use the saved value when it is a number, otherwise the default
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

      // Adds one to a counter field, records it for undo, and refreshes the page
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

    // Monthly plan buttons (monthly.html)
    function showPlanMessage(text) {
        var msg = document.getElementById("planMessage");
        if (msg) {
            msg.textContent = text;
        }
    }

    var btnStudentPlan = document.getElementById("btnStudentPlan");
    if (btnStudentPlan) {
        btnStudentPlan.addEventListener("click", function() {
            addOne("studentPlanCount");
            showPlanMessage("Student plan recorded (₱700)");
        });
    }

    var btnRegularPlan = document.getElementById("btnRegularPlan");
    if (btnRegularPlan) {
        btnRegularPlan.addEventListener("click", function() {
            addOne("regularPlanCount");
            showPlanMessage("Regular plan recorded (₱750)");
        });
    }

       // Undo and Reset buttons (all dashboard pages)
    var btnResetDay = document.getElementById("btnResetDay");
    if (btnResetDay) {
        // Create the Undo button and group it with Reset Day, so no HTML edits are needed
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

            // Shown until the next update replaces the note
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