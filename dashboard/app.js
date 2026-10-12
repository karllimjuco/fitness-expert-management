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

    // Shared storage and calculation helpers
    function loadMembers() {
        var raw = localStorage.getItem("gym_members");
        if (!raw) return [];
        try {
            return JSON.parse(raw) || [];
        } catch (e) {
            return [];
        }
    }

    function saveMembers(members) {
        localStorage.setItem("gym_members", JSON.stringify(members || []));
    }

    function loadLog() {
        var raw = localStorage.getItem("gym_transactions");
        if (!raw) return [];
        try {
            return JSON.parse(raw) || [];
        } catch (e) {
            return [];
        }
    }

    function saveLog(log) {
        localStorage.setItem("gym_transactions", JSON.stringify(log || []));
    }

    function toDateString(d) {
        if (!d) return "";
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function todayString() {
        return toDateString(new Date());
    }

    function parseDate(str) {
        if (!str) return new Date();
        var parts = String(str).split("-");
        if (parts.length === 3) {
            var y = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10) - 1;
            var d = parseInt(parts[2], 10);
            return new Date(y, m, d);
        }
        return new Date(str);
    }

    function addDays(d, days) {
        var dateObj = typeof d === "string" ? parseDate(d) : new Date(d.getTime());
        dateObj.setDate(dateObj.getDate() + days);
        return dateObj;
    }

    function formatDate(dateStr) {
        if (!dateStr) return "";
        var d = typeof dateStr === "string" ? parseDate(dateStr) : dateStr;
        if (isNaN(d.getTime())) return "";
        var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return months[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
    }

    function peso(amount) {
        var num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
        return "₱ " + Math.round(num).toLocaleString();
    }

    function getPlanStatus(member) {
        if (!member) return "None";
        var plan = member.planType || member.monthlyPlan;
        if (!plan || plan === "None" || !member.planExpiry) {
            return "None";
        }
        var today = todayString();
        var expiry = member.planExpiry;
        if (expiry < today) {
            return "Expired";
        }
        var expiringCutoff = toDateString(addDays(new Date(), 7));
        if (expiry <= expiringCutoff) {
            return "Expiring Soon";
        }
        return "Active";
    }

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

        // Fill Total Members on the second summary card across pages
        var members = loadMembers();
        var summaryCards = document.querySelectorAll(".summary-card");
        if (summaryCards.length >= 2) {
            var card2 = summaryCards[1];
            var valEl = card2.querySelector(".value");
            if (valEl) {
                valEl.textContent = members.length;
            }
            var noteEl = card2.querySelector(".card-note");
            if (noteEl) {
                var activeCount = 0;
                var expiringCount = 0;
                members.forEach(function(m) {
                    var s = getPlanStatus(m);
                    if (s === "Active") activeCount++;
                    else if (s === "Expiring Soon") expiringCount++;
                });
                noteEl.textContent = activeCount + " active · " + expiringCount + " expiring soon";
            }
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

// ----- Member popup (pick a registered member) -----
function openDayPassModal(label, price, field) {
    var members = loadMembers();
    var modal = document.getElementById("dayPassModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "dayPassModal";
        modal.style.cssText = "display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);align-items:center;justify-content:center;z-index:1000;";
        modal.innerHTML =
            '<div style="background:#1b1b1b;border:1px solid #2c2c2c;border-radius:14px;width:560px;max-width:92%;max-height:85vh;overflow-y:auto;padding:28px 32px;color:#fff;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                    '<h3 id="dayPassTitle" style="margin:0;font-size:1.6rem;font-weight:700;"></h3>' +
                    '<button type="button" id="dayPassClose" style="background:none;border:none;color:#fff;font-size:1.8rem;line-height:1;cursor:pointer;">&times;</button>' +
                '</div>' +
                '<p id="dayPassSub" style="margin:10px 0 18px;color:#9a9a9a;"></p>' +
                '<ul id="dayPassList" style="list-style:none;margin:0;padding:0;"></ul>' +
            '</div>';
        document.body.appendChild(modal);

        modal.querySelector("#dayPassClose").addEventListener("click", function() {
            modal.style.display = "none";
        });
        modal.addEventListener("click", function(e) {
            if (e.target === modal) modal.style.display = "none";
        });
    }

    document.getElementById("dayPassTitle").textContent = "Assign " + label + " (₱" + price + ")";
    document.getElementById("dayPassSub").textContent = "Select the member for this day pass:";

    var listEl = document.getElementById("dayPassList");
    listEl.innerHTML = "";

    members.forEach(function(member, i) {
        var sub = member.planExpiry ? "Expired on: " + member.planExpiry : "No Active Monthly Pass";
        var li = document.createElement("li");
        li.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:16px 0;" +
            (i < members.length - 1 ? "border-bottom:1px solid #2c2c2c;" : "");
        li.innerHTML =
            '<div>' +
                '<div style="font-size:1.25rem;font-weight:700;">' + member.name +
                    ' <span style="font-size:1rem;font-weight:400;color:#9a9a9a;">(' + member.id + ')</span></div>' +
                '<div style="font-size:0.95rem;color:#8a8a8a;margin-top:4px;">' + sub + '</div>' +
            '</div>' +
            '<button type="button" style="background:#c8c8c8;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:1rem;font-weight:700;cursor:pointer;">Select</button>';

        li.querySelector("button").addEventListener("click", function() {
            modal.style.display = "none";
            addOne(field);
        });
        listEl.appendChild(li);
    });

    modal.style.display = "flex";
}

// ----- Non-Member popup (name + phone/email) -----
function openNonMemberModal() {
    var modal = document.getElementById("nonMemberModal");

    if (!modal) {
        modal = document.createElement("div");
        modal.id = "nonMemberModal";
        modal.style.cssText = "display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.65);align-items:center;justify-content:center;z-index:1000;";

        var inputStyle = "width:100%;box-sizing:border-box;background:#111;border:1px solid #2c2c2c;border-radius:8px;color:#fff;padding:12px 14px;font-size:1rem;margin-top:6px;";
        var labelStyle = "display:block;color:#9a9a9a;font-size:0.95rem;margin-top:16px;";

        modal.innerHTML =
            '<div style="background:#1b1b1b;border:1px solid #2c2c2c;border-radius:14px;width:480px;max-width:92%;padding:28px 32px;color:#fff;">' +
                '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                    '<h3 style="margin:0;font-size:1.6rem;font-weight:700;">Non-Member Day Pass (₱80)</h3>' +
                    '<button type="button" id="nmClose" style="background:none;border:none;color:#fff;font-size:1.8rem;line-height:1;cursor:pointer;">&times;</button>' +
                '</div>' +
                '<p style="margin:10px 0 0;color:#9a9a9a;">Enter the guest\'s details to log this pass.</p>' +

                '<label style="' + labelStyle + '">Full Name' +
                    '<input type="text" id="nmName" placeholder="e.g. Juan Dela Cruz" style="' + inputStyle + '">' +
                '</label>' +

                '<label style="' + labelStyle + '">Phone Number or Email' +
                    '<input type="text" id="nmContact" placeholder="0917-123-4567 or name@email.com" style="' + inputStyle + '">' +
                '</label>' +

                '<p id="nmError" style="color:#ff6b6b;font-size:0.9rem;margin:12px 0 0;min-height:1.2em;"></p>' +

                '<button type="button" id="nmSubmit" style="width:100%;margin-top:12px;background:#fff;color:#111;border:none;border-radius:999px;padding:14px;font-size:1rem;font-weight:700;cursor:pointer;">Add Pass (+₱80)</button>' +
            '</div>';
        document.body.appendChild(modal);

        function closeIt() { modal.style.display = "none"; }
        modal.querySelector("#nmClose").addEventListener("click", closeIt);
        modal.addEventListener("click", function(e) {
            if (e.target === modal) closeIt();
        });

        modal.querySelector("#nmSubmit").addEventListener("click", function() {
            var name = document.getElementById("nmName").value.trim();
            var contact = document.getElementById("nmContact").value.trim();
            var errEl = document.getElementById("nmError");

            if (!name) {
                errEl.textContent = "Please enter the guest's name.";
                return;
            }
            if (!contact) {
                errEl.textContent = "Please enter a phone number or email.";
                return;
            }

            var isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
            var isPhone = /^[0-9+\-\s()]{7,}$/.test(contact);
            if (!isEmail && !isPhone) {
                errEl.textContent = "Enter a valid phone number or email.";
                return;
            }

            var guests = [];
            try { guests = JSON.parse(localStorage.getItem("gym_guests")) || []; } catch (e) {}
            guests.push({ name: name, contact: contact, date: new Date().toISOString() });
            localStorage.setItem("gym_guests", JSON.stringify(guests));

            closeIt();
            addOne("nonMemberCount");
        });
    }

    document.getElementById("nmName").value = "";
    document.getElementById("nmContact").value = "";
    document.getElementById("nmError").textContent = "";

    modal.style.display = "flex";
    document.getElementById("nmName").focus();
}

// ----- Button handlers -----
var btnAddNonMember = document.getElementById("btnAddNonMember");
if (btnAddNonMember) {
    btnAddNonMember.addEventListener("click", function() {
        openNonMemberModal();
    });
}

var btnAddMember = document.getElementById("btnAddMember");
if (btnAddMember) {
    btnAddMember.addEventListener("click", function() {
        openDayPassModal("Member Day Pass", 60, "memberCount");
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

    // Expose shared gym data helpers for statistics and other modules
    window.gymData = {
        loadMembers: loadMembers,
        saveMembers: saveMembers,
        loadLog: loadLog,
        saveLog: saveLog,
        getPlanStatus: getPlanStatus,
        todayString: todayString,
        toDateString: toDateString,
        parseDate: parseDate,
        addDays: addDays,
        formatDate: formatDate,
        peso: peso,
        refresh: updateUI
    };
})();