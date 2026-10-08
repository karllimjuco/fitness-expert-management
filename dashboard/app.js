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
    // Base revenue before new day passes is ₱3,250 (so ₱3,250 + 14 initial passes [8*80 + 6*60 = ₱980] = ₱4,230)
    var DEFAULT_DATA = {
        baseRevenue: 3250,
        nonMemberCount: 8,
        memberCount: 6
    };

    function loadCounters() {
        var raw = localStorage.getItem("gym_daily_counters");
        if (!raw) {
            return {
                baseRevenue: DEFAULT_DATA.baseRevenue,
                nonMemberCount: DEFAULT_DATA.nonMemberCount,
                memberCount: DEFAULT_DATA.memberCount
            };
        }
        try {
            var parsed = JSON.parse(raw);
            return {
                baseRevenue: typeof parsed.baseRevenue === "number" ? parsed.baseRevenue : DEFAULT_DATA.baseRevenue,
                nonMemberCount: typeof parsed.nonMemberCount === "number" ? parsed.nonMemberCount : DEFAULT_DATA.nonMemberCount,
                memberCount: typeof parsed.memberCount === "number" ? parsed.memberCount : DEFAULT_DATA.memberCount
            };
        } catch (e) {
            return {
                baseRevenue: DEFAULT_DATA.baseRevenue,
                nonMemberCount: DEFAULT_DATA.nonMemberCount,
                memberCount: DEFAULT_DATA.memberCount
            };
        }
    }

    function saveCounters(data) {
        localStorage.setItem("gym_daily_counters", JSON.stringify(data));
    }

    function updateUI() {
        var data = loadCounters();
        var passesCount = data.nonMemberCount + data.memberCount;
        var passRevenue = (data.nonMemberCount * 80) + (data.memberCount * 60);
        var totalRevenue = data.baseRevenue + passRevenue;

        // Today's revenue stat card
        var revVal = document.getElementById("todayRevenueVal");
        if (revVal) {
            revVal.textContent = "₱ " + totalRevenue.toLocaleString();
        }

        var revNote = document.getElementById("todayRevenueNote");
        if (revNote) {
            revNote.textContent = "+ Includes ₱" + passRevenue.toLocaleString() + " from " + passesCount + " Day Passes";
        }

        // Guest passes today stat card
        var passesVal = document.getElementById("guestPassesVal");
        if (passesVal) {
            passesVal.textContent = passesCount;
        }

        var passesNote = document.getElementById("guestPassesNote");
        if (passesNote) {
            passesNote.textContent = data.nonMemberCount + " Non-Members (₱80) · " + data.memberCount + " Members (₱60)";
        }

        // Current day total pill in day-pass section (dashboard.html only)
        var dayTotalPill = document.getElementById("dayTotalPill");
        if (dayTotalPill) {
            dayTotalPill.textContent = "₱ " + totalRevenue.toLocaleString() + ".00";
        }
    }

    // Day pass tap handlers (present on dashboard.html)
    var btnAddNonMember = document.getElementById("btnAddNonMember");
    if (btnAddNonMember) {
        btnAddNonMember.addEventListener("click", function() {
            var data = loadCounters();
            data.nonMemberCount += 1;
            saveCounters(data);
            updateUI();
        });
    }

    var btnAddMember = document.getElementById("btnAddMember");
    if (btnAddMember) {
        btnAddMember.addEventListener("click", function() {
            var data = loadCounters();
            data.memberCount += 1;
            saveCounters(data);
            updateUI();
        });
    }

    // Reset day button handler (present on all dashboard pages in the header or summary grid)
    var btnResetDay = document.getElementById("btnResetDay");
    if (btnResetDay) {
        btnResetDay.addEventListener("click", function() {
            var confirmed = confirm("Are you sure you want to reset today's daily counters to 0?");
            if (confirmed) {
                var resetData = {
                    baseRevenue: 0,
                    nonMemberCount: 0,
                    memberCount: 0
                };
                saveCounters(resetData);
                updateUI();
            }
        });
    }

    // Initial render
    updateUI();
})();
