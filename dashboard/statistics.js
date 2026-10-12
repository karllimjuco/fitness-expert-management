// Statistics page logic: data aggregation, inline SVG charts, plan health, and sample data generation.

(function() {
    var dataApi = window.gymData || {};
    var SVG_NS = "http://www.w3.org/2000/svg";

    // Chart toggle states
    var memberGrowthSeries = "new"; // "new" or "total"
    var revTimeRange = 30; // 7 or 30

    // Safely empty a container without innerHTML
    function clearElement(el) {
        while (el && el.firstChild) {
            el.removeChild(el.firstChild);
        }
    }

    // Helper to create SVG elements with attributes
    function createSvgElement(tag, attrs) {
        var el = document.createElementNS(SVG_NS, tag);
        if (attrs) {
            for (var key in attrs) {
                el.setAttribute(key, attrs[key]);
            }
        }
        return el;
    }

    // Formats a number with thousands separators and peso symbol
    function formatPeso(amount) {
        if (dataApi.peso) {
            return dataApi.peso(amount);
        }
        var num = typeof amount === "number" ? amount : parseFloat(amount) || 0;
        return "₱ " + Math.round(num).toLocaleString();
    }

    // Checks whether the dataset has any meaningful records
    function hasAnyData(members, transactions) {
        return (members && members.length > 0) || (transactions && transactions.length > 0);
    }

    // Computes round "nice" Y-axis step and ticks starting at 0
    function calculateNiceScale(maxVal, tickCount) {
        if (maxVal <= 0) {
            return { max: 10, ticks: [0, 2.5, 5, 7.5, 10] };
        }
        var roughStep = maxVal / (tickCount - 1);
        var magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
        var factor = roughStep / magnitude;
        var niceFactor = 1;

        if (factor <= 1) {
            niceFactor = 1;
        } else if (factor <= 2) {
            niceFactor = 2;
        } else if (factor <= 2.5) {
            niceFactor = 2.5;
        } else if (factor <= 5) {
            niceFactor = 5;
        } else {
            niceFactor = 10;
        }

        var step = niceFactor * magnitude;
        var max = step * (tickCount - 1);
        while (max < maxVal) {
            max += step;
        }

        var ticks = [];
        for (var i = 0; i < tickCount; i++) {
            ticks.push(Math.round(step * i));
        }
        return { max: ticks[ticks.length - 1], ticks: ticks };
    }

    // Formats Date object to local YYYY-MM-DD
    function toLocalYMD(d) {
        var year = d.getFullYear();
        var month = String(d.getMonth() + 1).padStart(2, "0");
        var day = String(d.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    // Month abbreviations for labels
    var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // 1. RENDER SUMMARY CARDS
    function renderSummaryCards(members, transactions) {
        var lifetimeRev = 0;
        var dayPassRev = 0;
        var planRev = 0;
        var feeRev = 0;

        for (var i = 0; i < transactions.length; i++) {
            var t = transactions[i];
            var amt = Number(t.amount) || 0;
            lifetimeRev += amt;
            if (t.type === "nonmember_pass" || t.type === "member_pass") {
                dayPassRev += amt;
            } else if (t.type === "monthly_plan") {
                planRev += amt;
            } else if (t.type === "membership_fee") {
                feeRev += amt;
            }
        }

        // Lifetime Revenue card
        var revValEl = document.getElementById("lifetimeRevenueVal");
        if (revValEl) {
            revValEl.textContent = formatPeso(lifetimeRev);
        }

        var revNoteEl = document.getElementById("lifetimeRevenueNote");
        if (revNoteEl) {
            revNoteEl.textContent = "Day passes " + formatPeso(dayPassRev) + " · Monthly plans " +
                formatPeso(planRev) + " · Memberships " + formatPeso(feeRev);
        }

        // New Members This Month card (trend based on last 2 complete months)
        var now = new Date();
        var currentYm = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");

        var dLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        var lastMonthYm = dLastMonth.getFullYear() + "-" + String(dLastMonth.getMonth() + 1).padStart(2, "0");

        var dBeforeMonth = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        var beforeMonthYm = dBeforeMonth.getFullYear() + "-" + String(dBeforeMonth.getMonth() + 1).padStart(2, "0");

        var currentMonthCount = 0;
        var lastMonthCount = 0;
        var beforeMonthCount = 0;

        for (var j = 0; j < members.length; j++) {
            var m = members[j];
            if (!m.joinDate) continue;
            var ym = m.joinDate.slice(0, 7);
            if (ym === currentYm) {
                currentMonthCount++;
            } else if (ym === lastMonthYm) {
                lastMonthCount++;
            } else if (ym === beforeMonthYm) {
                beforeMonthCount++;
            }
        }

        var newMembersValEl = document.getElementById("newMembersMonthVal");
        if (newMembersValEl) {
            newMembersValEl.textContent = currentMonthCount;
        }

        var trendDiff = lastMonthCount - beforeMonthCount;
        var trendText = "";
        if (trendDiff > 0) {
            trendText = "Last month: " + lastMonthCount + ", up " + trendDiff + " from the month before";
        } else if (trendDiff < 0) {
            trendText = "Last month: " + lastMonthCount + ", down " + Math.abs(trendDiff) + " from the month before";
        } else {
            trendText = "Last month: " + lastMonthCount + ", no change from the month before";
        }

        var newMembersNoteEl = document.getElementById("newMembersMonthNote");
        if (newMembersNoteEl) {
            newMembersNoteEl.textContent = trendText;
        }

        return {
            lastMonthCount: lastMonthCount,
            beforeMonthCount: beforeMonthCount,
            trendDiff: trendDiff
        };
    }

    // 2. MEMBER GROWTH LINE CHART
    function renderMemberGrowth(members, trendInfo) {
        var box = document.getElementById("memberGrowthBox");
        var meta = document.getElementById("memberGrowthMeta");
        var alt = document.getElementById("memberGrowthAlt");
        if (!box) return;

        clearElement(box);

        if (!members || members.length === 0) {
            var empty = document.createElement("div");
            empty.className = "gx-empty-state";
            empty.textContent = "No data yet. Use Load demo data below.";
            box.appendChild(empty);
            if (meta) meta.textContent = "Trend: Flat";
            if (alt) alt.textContent = "";
            return;
        }

        // Build last 6 calendar months
        var now = new Date();
        var monthsList = [];
        for (var i = 5; i >= 0; i--) {
            var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            var ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
            monthsList.push({
                ym: ym,
                name: MONTH_NAMES[d.getMonth()],
                isCurrent: i === 0,
                year: d.getFullYear()
            });
        }

        // Compute counts per month and cumulative
        var newCounts = [];
        var cumulativeCounts = [];
        var runningTotal = 0;

        // Count members registered before the 6-month window
        var oldestYm = monthsList[0].ym;
        for (var j = 0; j < members.length; j++) {
            if (members[j].joinDate && members[j].joinDate.slice(0, 7) < oldestYm) {
                runningTotal++;
            }
        }

        for (var mIdx = 0; mIdx < monthsList.length; mIdx++) {
            var targetYm = monthsList[mIdx].ym;
            var cnt = 0;
            for (var k = 0; k < members.length; k++) {
                if (members[k].joinDate && members[k].joinDate.slice(0, 7) === targetYm) {
                    cnt++;
                }
            }
            newCounts.push(cnt);
            runningTotal += cnt;
            cumulativeCounts.push(runningTotal);
        }

        var values = memberGrowthSeries === "total" ? cumulativeCounts : newCounts;
        var maxVal = 0;
        for (var vIdx = 0; vIdx < values.length; vIdx++) {
            if (values[vIdx] > maxVal) maxVal = values[vIdx];
        }

        var scale = calculateNiceScale(maxVal, 5);

        // SVG Dimensions
        var svgWidth = 640;
        var svgHeight = 260;
        var padLeft = 45;
        var padRight = 30;
        var padTop = 30;
        var padBottom = 40;
        var plotWidth = svgWidth - padLeft - padRight;
        var plotHeight = svgHeight - padTop - padBottom;

        var svg = createSvgElement("svg", {
            viewBox: "0 0 " + svgWidth + " " + svgHeight,
            class: "gx-chart-svg",
            role: "img",
            "aria-label": "Member growth line chart"
        });

        // Horizontal gridlines & Y labels
        for (var t = 0; t < scale.ticks.length; t++) {
            var tickVal = scale.ticks[t];
            var yPos = padTop + plotHeight - (tickVal / scale.max) * plotHeight;

            var gridline = createSvgElement("line", {
                x1: padLeft,
                y1: yPos,
                x2: padLeft + plotWidth,
                y2: yPos,
                stroke: "rgba(255, 255, 255, 0.1)",
                "stroke-width": "1"
            });
            svg.appendChild(gridline);

            var yLabel = createSvgElement("text", {
                x: padLeft - 8,
                y: yPos + 4,
                fill: "rgba(255, 255, 255, 0.65)",
                "font-size": "11",
                "text-anchor": "end",
                "font-family": "Verdana, sans-serif"
            });
            yLabel.textContent = tickVal.toString();
            svg.appendChild(yLabel);
        }

        // Plot points & calculate path
        var points = [];
        for (var p = 0; p < values.length; p++) {
            var xPos = padLeft + (p / (values.length - 1)) * plotWidth;
            var yPosVal = padTop + plotHeight - (values[p] / scale.max) * plotHeight;
            points.push({ x: xPos, y: yPosVal, val: values[p], month: monthsList[p] });
        }

        // Draw line stroke
        var pathD = "";
        for (var pt = 0; pt < points.length; pt++) {
            pathD += (pt === 0 ? "M " : " L ") + points[pt].x.toFixed(1) + " " + points[pt].y.toFixed(1);
        }

        var linePath = createSvgElement("path", {
            d: pathD,
            fill: "none",
            stroke: "rgba(255, 255, 255, 0.88)",
            "stroke-width": "2.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
        });
        svg.appendChild(linePath);

        // Draw circles, tooltips, and X-axis labels
        for (var c = 0; c < points.length; c++) {
            var ptObj = points[c];

            var circle = createSvgElement("circle", {
                cx: ptObj.x.toFixed(1),
                cy: ptObj.y.toFixed(1),
                r: "4.5",
                fill: "#ffffff",
                stroke: "rgba(10, 13, 18, 0.8)",
                "stroke-width": "1.5"
            });

            var titleEl = createSvgElement("title");
            var tooltipLabel = ptObj.month.name + " " + ptObj.month.year + ": " + ptObj.val;
            if (ptObj.month.isCurrent) {
                tooltipLabel += " (so far)";
            }
            titleEl.textContent = tooltipLabel;
            circle.appendChild(titleEl);
            svg.appendChild(circle);

            // X-axis label
            var xLabel = createSvgElement("text", {
                x: ptObj.x.toFixed(1),
                y: svgHeight - 16,
                fill: "rgba(255, 255, 255, 0.7)",
                "font-size": "11",
                "text-anchor": "middle",
                "font-family": "Verdana, sans-serif"
            });
            xLabel.textContent = ptObj.month.name;
            svg.appendChild(xLabel);
        }

        box.appendChild(svg);

        // Trend line based on last two complete months
        if (meta) {
            var trendState = "Trend: Flat";
            if (trendInfo.trendDiff > 0) trendState = "Trend: Up";
            else if (trendInfo.trendDiff < 0) trendState = "Trend: Down";
            meta.textContent = trendState;
        }

        // Text alternative
        if (alt) {
            var summaryList = [];
            for (var a = 0; a < points.length; a++) {
                summaryList.push(points[a].month.name + ": " + points[a].val + (points[a].month.isCurrent ? " (so far)" : ""));
            }
            alt.textContent = (memberGrowthSeries === "total" ? "Cumulative totals: " : "Monthly registrations: ") +
                summaryList.join(", ");
        }
    }

    // 3. REVENUE OVER TIME LINE CHART
    function renderRevenueOverTime(transactions) {
        var box = document.getElementById("revTimeBox");
        var meta = document.getElementById("revTimeMeta");
        var alt = document.getElementById("revTimeAlt");
        if (!box) return;

        clearElement(box);

        if (!transactions || transactions.length === 0) {
            var empty = document.createElement("div");
            empty.className = "gx-empty-state";
            empty.textContent = "No data yet. Use Load demo data below.";
            box.appendChild(empty);
            if (meta) meta.textContent = "Average daily revenue: ₱ 0";
            if (alt) alt.textContent = "";
            return;
        }

        // Build list of target dates (today backward)
        var today = new Date();
        var daysCount = revTimeRange;
        var dayPoints = [];

        for (var i = daysCount - 1; i >= 0; i--) {
            var curDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
            var ymd = toLocalYMD(curDate);
            dayPoints.push({
                dateObj: curDate,
                ymd: ymd,
                monthShort: MONTH_NAMES[curDate.getMonth()],
                dayNum: curDate.getDate(),
                revenue: 0
            });
        }

        // Sum transactions into day buckets
        for (var t = 0; t < transactions.length; t++) {
            var txn = transactions[t];
            if (!txn.time) continue;
            var txnDateStr = txn.time.slice(0, 10);
            for (var d = 0; d < dayPoints.length; d++) {
                if (dayPoints[d].ymd === txnDateStr) {
                    dayPoints[d].revenue += Number(txn.amount) || 0;
                    break;
                }
            }
        }

        var totalRevRange = 0;
        var maxRev = 0;
        for (var r = 0; r < dayPoints.length; r++) {
            totalRevRange += dayPoints[r].revenue;
            if (dayPoints[r].revenue > maxRev) maxRev = dayPoints[r].revenue;
        }

        var avgDaily = daysCount > 0 ? totalRevRange / daysCount : 0;
        var scale = calculateNiceScale(maxRev, 5);

        // SVG Dimensions
        var svgWidth = 640;
        var svgHeight = 260;
        var padLeft = 65;
        var padRight = 30;
        var padTop = 30;
        var padBottom = 40;
        var plotWidth = svgWidth - padLeft - padRight;
        var plotHeight = svgHeight - padTop - padBottom;

        var svg = createSvgElement("svg", {
            viewBox: "0 0 " + svgWidth + " " + svgHeight,
            class: "gx-chart-svg",
            role: "img",
            "aria-label": "Revenue over time line chart"
        });

        // Gridlines & Y axis labels
        for (var tIdx = 0; tIdx < scale.ticks.length; tIdx++) {
            var tickVal = scale.ticks[tIdx];
            var yPos = padTop + plotHeight - (tickVal / scale.max) * plotHeight;

            var gridline = createSvgElement("line", {
                x1: padLeft,
                y1: yPos,
                x2: padLeft + plotWidth,
                y2: yPos,
                stroke: "rgba(255, 255, 255, 0.1)",
                "stroke-width": "1"
            });
            svg.appendChild(gridline);

            var yLabel = createSvgElement("text", {
                x: padLeft - 8,
                y: yPos + 4,
                fill: "rgba(255, 255, 255, 0.65)",
                "font-size": "11",
                "text-anchor": "end",
                "font-family": "Verdana, sans-serif"
            });
            yLabel.textContent = "₱ " + tickVal.toLocaleString();
            svg.appendChild(yLabel);
        }

        // Plot points
        var points = [];
        for (var p = 0; p < dayPoints.length; p++) {
            var xPos = padLeft + (p / (dayPoints.length - 1)) * plotWidth;
            var yPosVal = padTop + plotHeight - (dayPoints[p].revenue / scale.max) * plotHeight;
            points.push({ x: xPos, y: yPosVal, day: dayPoints[p], index: p });
        }

        // Path
        var pathD = "";
        for (var pt = 0; pt < points.length; pt++) {
            pathD += (pt === 0 ? "M " : " L ") + points[pt].x.toFixed(1) + " " + points[pt].y.toFixed(1);
        }

        var linePath = createSvgElement("path", {
            d: pathD,
            fill: "none",
            stroke: "rgba(255, 255, 255, 0.88)",
            "stroke-width": "2.5",
            "stroke-linecap": "round",
            "stroke-linejoin": "round"
        });
        svg.appendChild(linePath);

        // Draw points and X labels
        for (var c = 0; c < points.length; c++) {
            var ptObj = points[c];

            var circle = createSvgElement("circle", {
                cx: ptObj.x.toFixed(1),
                cy: ptObj.y.toFixed(1),
                r: "3.5",
                fill: "#ffffff",
                stroke: "rgba(10, 13, 18, 0.8)",
                "stroke-width": "1.5"
            });

            var titleEl = createSvgElement("title");
            titleEl.textContent = ptObj.day.monthShort + " " + ptObj.day.dayNum + ": " + formatPeso(ptObj.day.revenue);
            circle.appendChild(titleEl);
            svg.appendChild(circle);

            // Determine if X label should show (every 5th for 30 days, or all for 7 days)
            var showLabel = false;
            if (daysCount === 7) {
                showLabel = true;
            } else {
                if (c % 5 === 0 || c === points.length - 1) {
                    showLabel = true;
                }
            }

            if (showLabel) {
                var xLabel = createSvgElement("text", {
                    x: ptObj.x.toFixed(1),
                    y: svgHeight - 16,
                    fill: "rgba(255, 255, 255, 0.7)",
                    "font-size": "10",
                    "text-anchor": "middle",
                    "font-family": "Verdana, sans-serif"
                });
                xLabel.textContent = ptObj.day.monthShort + " " + ptObj.day.dayNum;
                svg.appendChild(xLabel);
            }
        }

        box.appendChild(svg);

        if (meta) {
            meta.textContent = "Average daily revenue: " + formatPeso(avgDaily);
        }

        if (alt) {
            alt.textContent = "Total revenue for past " + daysCount + " days: " + formatPeso(totalRevRange) +
                " across " + daysCount + " recorded days.";
        }
    }

    // 4. REVENUE BY TYPE (HORIZONTAL BARS)
    function renderRevenueByType(transactions) {
        var container = document.getElementById("revenueTypeBars");
        var alt = document.getElementById("revenueTypeAlt");
        if (!container) return;

        clearElement(container);

        if (!transactions || transactions.length === 0) {
            var empty = document.createElement("div");
            empty.className = "gx-empty-state";
            empty.textContent = "No data yet. Use Load demo data below.";
            container.appendChild(empty);
            if (alt) alt.textContent = "";
            return;
        }

        var dayPassRev = 0;
        var monthlyRev = 0;
        var feeRev = 0;
        var totalRev = 0;

        for (var i = 0; i < transactions.length; i++) {
            var t = transactions[i];
            var amt = Number(t.amount) || 0;
            totalRev += amt;
            if (t.type === "nonmember_pass" || t.type === "member_pass") {
                dayPassRev += amt;
            } else if (t.type === "monthly_plan") {
                monthlyRev += amt;
            } else if (t.type === "membership_fee") {
                feeRev += amt;
            }
        }

        var categories = [
            { label: "Day passes", amount: dayPassRev },
            { label: "Monthly plans", amount: monthlyRev },
            { label: "Memberships", amount: feeRev }
        ];

        for (var c = 0; c < categories.length; c++) {
            var cat = categories[c];
            var pct = totalRev > 0 ? Math.round((cat.amount / totalRev) * 100) : 0;

            var item = document.createElement("div");
            item.className = "gx-bar-item";

            var labelRow = document.createElement("div");
            labelRow.className = "gx-bar-label-row";

            var labelSpan = document.createElement("span");
            labelSpan.className = "gx-bar-label";
            labelSpan.textContent = cat.label;

            var valSpan = document.createElement("span");
            valSpan.className = "gx-bar-value";
            valSpan.textContent = formatPeso(cat.amount) + " (" + pct + "%)";

            labelRow.appendChild(labelSpan);
            labelRow.appendChild(valSpan);

            var track = document.createElement("div");
            track.className = "gx-bar-track";

            var fill = document.createElement("div");
            fill.className = "gx-bar-fill";
            fill.style.width = pct + "%";

            track.appendChild(fill);
            item.appendChild(labelRow);
            item.appendChild(track);
            container.appendChild(item);
        }

        if (alt) {
            alt.textContent = "Lifetime total: " + formatPeso(totalRev) +
                " (Day passes: " + formatPeso(dayPassRev) + ", Monthly plans: " + formatPeso(monthlyRev) +
                ", Memberships: " + formatPeso(feeRev) + ")";
        }
    }

    // 5. PLAN HEALTH
    function renderPlanHealth(members) {
        var cardsContainer = document.getElementById("planHealthCards");
        var listContainer = document.getElementById("expiringSoonList");
        var ratioEl = document.getElementById("studentRatioNote");
        if (!cardsContainer || !listContainer) return;

        clearElement(cardsContainer);
        clearElement(listContainer);

        if (!members || members.length === 0) {
            var empty = document.createElement("div");
            empty.className = "gx-empty-state";
            empty.style.gridColumn = "1 / -1";
            empty.textContent = "No data yet. Use Load demo data below.";
            cardsContainer.appendChild(empty);
            if (ratioEl) ratioEl.textContent = "Student members: 0, Non-Student members: 0";
            return;
        }

        var counts = {
            Active: 0,
            "Expiring Soon": 0,
            Expired: 0,
            "No Plan": 0
        };

        var studentCount = 0;
        var nonStudentCount = 0;
        var expiringSoonMembers = [];

        var getStatusFn = dataApi.getPlanStatus || function(m) {
            if (!m.planExpiry) return "None";
            var today = toLocalYMD(new Date());
            if (m.planExpiry < today) return "Expired";
            var cut = new Date();
            cut.setDate(cut.getDate() + 7);
            if (m.planExpiry <= toLocalYMD(cut)) return "Expiring Soon";
            return "Active";
        };

        for (var i = 0; i < members.length; i++) {
            var m = members[i];
            var st = getStatusFn(m);

            if (st === "Active") counts.Active++;
            else if (st === "Expiring Soon") {
                counts["Expiring Soon"]++;
                expiringSoonMembers.push(m);
            } else if (st === "Expired") counts.Expired++;
            else counts["No Plan"]++;

            if (m.classification === "Student") studentCount++;
            else nonStudentCount++;
        }

        // Render 4 status count cards
        var statusDefs = [
            { key: "Active", label: "Active", badgeClass: "gx-badge gx-badge-active" },
            { key: "Expiring Soon", label: "Expiring Soon", badgeClass: "gx-badge gx-badge-expiring" },
            { key: "Expired", label: "Expired", badgeClass: "gx-badge gx-badge-expired" },
            { key: "No Plan", label: "No Plan", badgeClass: "gx-badge gx-badge-none" }
        ];

        for (var s = 0; s < statusDefs.length; s++) {
            var def = statusDefs[s];
            var card = document.createElement("div");
            card.className = "gx-status-card";

            var countDiv = document.createElement("div");
            countDiv.className = "gx-status-count";
            countDiv.textContent = counts[def.key].toString();

            var badgeSpan = document.createElement("span");
            badgeSpan.className = def.badgeClass;
            badgeSpan.textContent = def.label;

            card.appendChild(countDiv);
            card.appendChild(badgeSpan);
            cardsContainer.appendChild(card);
        }

        // Sort expiring members soonest first and display up to 5
        expiringSoonMembers.sort(function(a, b) {
            if (!a.planExpiry) return 1;
            if (!b.planExpiry) return -1;
            return a.planExpiry.localeCompare(b.planExpiry);
        });

        var displayList = expiringSoonMembers.slice(0, 5);
        if (displayList.length === 0) {
            var emptyLi = document.createElement("li");
            emptyLi.className = "gx-expiring-item";
            emptyLi.style.justifyContent = "center";
            emptyLi.style.color = "var(--brandcolor-1)";
            emptyLi.textContent = "No members expiring soon.";
            listContainer.appendChild(emptyLi);
        } else {
            for (var e = 0; e < displayList.length; e++) {
                var mem = displayList[e];
                var li = document.createElement("li");
                li.className = "gx-expiring-item";

                var nameSpan = document.createElement("span");
                nameSpan.className = "gx-expiring-name";
                nameSpan.textContent = mem.name + " (" + mem.id + ")";

                var dateSpan = document.createElement("span");
                dateSpan.className = "gx-expiring-date";
                var expDateStr = dataApi.formatDate ? dataApi.formatDate(mem.planExpiry) : mem.planExpiry;
                dateSpan.textContent = "Expires " + expDateStr;

                li.appendChild(nameSpan);
                li.appendChild(dateSpan);
                listContainer.appendChild(li);
            }
        }

        // Classification ratio
        if (ratioEl) {
            ratioEl.textContent = "Student members: " + studentCount + ", Non-Student members: " + nonStudentCount;
        }
    }

    // 6. BUSIEST DAYS (BAR CHART)
    function renderBusiestDays(transactions) {
        var box = document.getElementById("busiestDaysBox");
        var alt = document.getElementById("busiestDaysAlt");
        if (!box) return;

        clearElement(box);

        if (!transactions || transactions.length === 0) {
            var empty = document.createElement("div");
            empty.className = "gx-empty-state";
            empty.textContent = "No data yet. Use Load demo data below.";
            box.appendChild(empty);
            if (alt) alt.textContent = "";
            return;
        }

        // Weekdays Monday (0) to Sunday (6)
        var weekdays = [
            { label: "Mon", full: "Monday", count: 0 },
            { label: "Tue", full: "Tuesday", count: 0 },
            { label: "Wed", full: "Wednesday", count: 0 },
            { label: "Thu", full: "Thursday", count: 0 },
            { label: "Fri", full: "Friday", count: 0 },
            { label: "Sat", full: "Saturday", count: 0 },
            { label: "Sun", full: "Sunday", count: 0 }
        ];

        // JS getDay(): 0 is Sunday, 1 is Monday ... 6 is Saturday
        var dayMap = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 0: 6 };

        for (var i = 0; i < transactions.length; i++) {
            var t = transactions[i];
            if (t.type === "nonmember_pass" || t.type === "member_pass") {
                if (!t.time) continue;
                var dt = new Date(t.time);
                var jsDay = dt.getDay();
                var targetIdx = dayMap[jsDay];
                if (typeof targetIdx === "number") {
                    weekdays[targetIdx].count++;
                }
            }
        }

        var maxCount = 0;
        var totalPasses = 0;
        var busiestDay = weekdays[0];

        for (var w = 0; w < weekdays.length; w++) {
            totalPasses += weekdays[w].count;
            if (weekdays[w].count > maxCount) {
                maxCount = weekdays[w].count;
                busiestDay = weekdays[w];
            }
        }

        var scale = calculateNiceScale(maxCount, 5);

        // SVG Dimensions
        var svgWidth = 640;
        var svgHeight = 260;
        var padLeft = 45;
        var padRight = 30;
        var padTop = 30;
        var padBottom = 40;
        var plotWidth = svgWidth - padLeft - padRight;
        var plotHeight = svgHeight - padTop - padBottom;

        var svg = createSvgElement("svg", {
            viewBox: "0 0 " + svgWidth + " " + svgHeight,
            class: "gx-chart-svg",
            role: "img",
            "aria-label": "Busiest days bar chart"
        });

        // Gridlines & Y axis
        for (var t = 0; t < scale.ticks.length; t++) {
            var tickVal = scale.ticks[t];
            var yPos = padTop + plotHeight - (tickVal / scale.max) * plotHeight;

            var gridline = createSvgElement("line", {
                x1: padLeft,
                y1: yPos,
                x2: padLeft + plotWidth,
                y2: yPos,
                stroke: "rgba(255, 255, 255, 0.1)",
                "stroke-width": "1"
            });
            svg.appendChild(gridline);

            var yLabel = createSvgElement("text", {
                x: padLeft - 8,
                y: yPos + 4,
                fill: "rgba(255, 255, 255, 0.65)",
                "font-size": "11",
                "text-anchor": "end",
                "font-family": "Verdana, sans-serif"
            });
            yLabel.textContent = tickVal.toString();
            svg.appendChild(yLabel);
        }

        // Draw 7 bars
        var colWidth = plotWidth / weekdays.length;
        var barWidth = colWidth * 0.55;

        for (var b = 0; b < weekdays.length; b++) {
            var dayObj = weekdays[b];
            var barHeight = scale.max > 0 ? (dayObj.count / scale.max) * plotHeight : 0;
            var xPos = padLeft + b * colWidth + (colWidth - barWidth) / 2;
            var yPosVal = padTop + plotHeight - barHeight;

            var rect = createSvgElement("rect", {
                x: xPos.toFixed(1),
                y: yPosVal.toFixed(1),
                width: barWidth.toFixed(1),
                height: barHeight.toFixed(1),
                fill: "rgba(255, 255, 255, 0.5)",
                rx: "2"
            });

            var titleEl = createSvgElement("title");
            titleEl.textContent = dayObj.full + ": " + dayObj.count + " day passes";
            rect.appendChild(titleEl);
            svg.appendChild(rect);

            // X-axis label
            var xLabel = createSvgElement("text", {
                x: (xPos + barWidth / 2).toFixed(1),
                y: svgHeight - 16,
                fill: "rgba(255, 255, 255, 0.7)",
                "font-size": "11",
                "text-anchor": "middle",
                "font-family": "Verdana, sans-serif"
            });
            xLabel.textContent = dayObj.label;
            svg.appendChild(xLabel);
        }

        box.appendChild(svg);

        if (alt) {
            alt.textContent = "Total day passes: " + totalPasses +
                ". Busiest day: " + busiestDay.full + " (" + busiestDay.count + " passes).";
        }
    }

    // 7. STAFF ACTIVITY TABLE
    function renderStaffActivity(transactions) {
        var tbody = document.getElementById("staffActivityBody");
        if (!tbody) return;

        clearElement(tbody);

        if (!transactions || transactions.length === 0) {
            var tr = document.createElement("tr");
            var td = document.createElement("td");
            td.colSpan = 3;
            td.style.textAlign = "center";
            td.style.padding = "1.5rem";
            td.style.color = "var(--brandcolor-1)";
            td.textContent = "No data yet. Use Load demo data below.";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        // Aggregate by staff name
        var staffStats = {};
        for (var i = 0; i < transactions.length; i++) {
            var t = transactions[i];
            var name = t.staff || "Unassigned";
            if (!staffStats[name]) {
                staffStats[name] = { name: name, count: 0, revenue: 0 };
            }
            staffStats[name].count++;
            staffStats[name].revenue += Number(t.amount) || 0;
        }

        var staffList = [];
        for (var key in staffStats) {
            staffList.push(staffStats[key]);
        }

        // Sort by revenue descending
        staffList.sort(function(a, b) {
            return b.revenue - a.revenue;
        });

        for (var s = 0; s < staffList.length; s++) {
            var item = staffList[s];
            var tr = document.createElement("tr");

            var tdName = document.createElement("td");
            tdName.style.fontWeight = "600";
            tdName.textContent = item.name;

            var tdCount = document.createElement("td");
            tdCount.textContent = item.count.toLocaleString();

            var tdRev = document.createElement("td");
            tdRev.textContent = formatPeso(item.revenue);

            tr.appendChild(tdName);
            tr.appendChild(tdCount);
            tr.appendChild(tdRev);
            tbody.appendChild(tr);
        }
    }

    // 8. SAMPLE DATA INDICATOR
    function updateDemoNotice() {
        var notice = document.getElementById("sampleDataNotice");
        if (!notice) return;
        var loaded = localStorage.getItem("gym_demo_loaded");
        if (loaded === "yes") {
            notice.style.display = "inline-flex";
        } else {
            notice.style.display = "none";
        }
    }

    // 9. FULL PAGE RENDER
    function renderAll() {
        var members = dataApi.loadMembers ? dataApi.loadMembers() : (JSON.parse(localStorage.getItem("gym_members")) || []);
        var transactions = dataApi.loadLog ? dataApi.loadLog() : (JSON.parse(localStorage.getItem("gym_transactions")) || []);

        var trendInfo = renderSummaryCards(members, transactions);
        renderMemberGrowth(members, trendInfo);
        renderRevenueOverTime(transactions);
        renderRevenueByType(transactions);
        renderPlanHealth(members);
        renderBusiestDays(transactions);
        renderStaffActivity(transactions);
        updateDemoNotice();

        if (dataApi.refresh) {
            dataApi.refresh();
        }
    }

    // 10. DEMO DATA GENERATION LOGIC
    function generateDemoData() {
        var now = new Date();
        var staffNames = ["Karl Lopez", "Maria Santos", "Totle Admin"];
        var paymentMethods = ["Cash", "GCash", "Card"];

        var lastNames = [
            "Santos", "Dela Cruz", "Reyes", "Garcia", "Bautista", "Mendoza",
            "Aquino", "Ramos", "Tan", "Lim", "Flores", "Villanueva",
            "Castillo", "Gonzales", "Torres", "Navarro", "Rivera", "Soriano",
            "Corpuz", "Manalo", "Vergara", "Perez", "Santiago", "Salazar", "Valdez"
        ];

        var firstNames = [
            "Juan", "Maria", "Carlo", "Ana", "Paolo", "Liza", "Bea",
            "John", "Mark", "Grace", "Angelo", "Christine", "Kevin",
            "Patricia", "Rafael", "Kathryn", "Daniel", "Sarah", "Alden",
            "Enrique", "Nadine", "James", "Joshua", "Julia", "Gerald"
        ];

        // Target: about 75 members over the last 6 months, growing monthly counts
        var daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        var currentDaysPassed = now.getDate();
        var currentMonthFraction = currentDaysPassed / daysInCurrentMonth;
        var currentTarget = Math.max(4, Math.round(18 * currentMonthFraction));

        var monthlyCounts = [
            7 + Math.floor(Math.random() * 3),   // ~8-9
            9 + Math.floor(Math.random() * 3),   // ~10-11
            9 + Math.floor(Math.random() * 3),   // ~10-11
            13 + Math.floor(Math.random() * 3),  // ~14-15
            16 + Math.floor(Math.random() * 3),  // ~17-18
            currentTarget                        // ~6-8 scaled for days passed
        ];

        var members = [];
        var transactions = [];
        var txnCounter = 1;
        var memberIdCounter = 1001;

        // Generate member profiles across the 6 months
        for (var mIdx = 0; mIdx < 6; mIdx++) {
            var monthOffset = 5 - mIdx; // 5 months ago down to 0 (current month)
            var targetMonthDate = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
            var daysInThatMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();

            var countForThisMonth = monthlyCounts[mIdx];
            for (var c = 0; c < countForThisMonth; c++) {
                var lName = lastNames[Math.floor(Math.random() * lastNames.length)];
                var fName = firstNames[Math.floor(Math.random() * firstNames.length)];
                var isStudent = Math.random() < 0.6;

                // Day of joining
                var maxDay = monthOffset === 0 ? Math.min(now.getDate(), daysInThatMonth) : daysInThatMonth;
                var joinDay = 1 + Math.floor(Math.random() * maxDay);
                var joinDateObj = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth(), joinDay);
                var joinDateStr = toLocalYMD(joinDateObj);

                var memberId = "#" + memberIdCounter;
                var phoneStr = "09000000" + String(memberIdCounter).slice(-3);
                var emailStr = fName.toLowerCase() + "." + lName.toLowerCase() + memberIdCounter + "@example.com";

                var memberObj = {
                    id: memberId,
                    name: lName + ", " + fName,
                    phone: phoneStr,
                    contact: phoneStr,
                    email: emailStr,
                    classification: isStudent ? "Student" : "Non-Student",
                    joinDate: joinDateStr,
                    lifetimeMember: true,
                    monthlyPlan: "None",
                    planType: "None",
                    planExpiry: null
                };

                memberIdCounter++;
                members.push(memberObj);

                // Membership fee entry on join date
                var joinHour = 6 + Math.floor(Math.random() * 14);
                var joinMinute = Math.floor(Math.random() * 60);
                if (monthOffset === 0 && joinDay === now.getDate()) {
                    if (joinHour >= now.getHours()) {
                        joinHour = Math.max(6, now.getHours() - 1);
                    }
                }
                var feeTimeStr = joinDateStr + "T" + String(joinHour).padStart(2, "0") + ":" +
                    String(joinMinute).padStart(2, "0") + ":00";

                transactions.push({
                    id: "TXN-" + String(txnCounter++).padStart(6, "0"),
                    type: "membership_fee",
                    label: "Lifetime Membership Fee",
                    amount: 350,
                    memberId: memberObj.id,
                    previousExpiry: null,
                    previousPlanType: null,
                    paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                    time: feeTimeStr,
                    staff: staffNames[Math.floor(Math.random() * staffNames.length)]
                });

                // 70% buy monthly plan on join date
                if (Math.random() < 0.7) {
                    var planType = isStudent ? "Student Monthly" : "Regular Monthly";
                    var planAmount = isStudent ? 700 : 750;

                    var planExpiryDate = new Date(joinDateObj.getTime());
                    planExpiryDate.setDate(planExpiryDate.getDate() + 30);
                    var planExpiryStr = toLocalYMD(planExpiryDate);

                    memberObj.monthlyPlan = planType;
                    memberObj.planType = planType;
                    memberObj.planExpiry = planExpiryStr;

                    transactions.push({
                        id: "TXN-" + String(txnCounter++).padStart(6, "0"),
                        type: "monthly_plan",
                        label: planType,
                        amount: planAmount,
                        memberId: memberObj.id,
                        previousExpiry: null,
                        previousPlanType: null,
                        paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                        time: feeTimeStr,
                        staff: staffNames[Math.floor(Math.random() * staffNames.length)]
                    });

                    // Renew every 30 days with ~75% chance per cycle
                    var currentCycleExpiry = new Date(planExpiryDate.getTime());
                    while (true) {
                        var renewalDate = new Date(currentCycleExpiry.getTime());
                        // Stop if renewal date is in the future
                        if (renewalDate > now) {
                            break;
                        }
                        if (toLocalYMD(renewalDate) === toLocalYMD(now) && now.getHours() < 7) {
                            break;
                        }

                        // 75% chance per renewal cycle
                        if (Math.random() < 0.75) {
                            var prevExp = toLocalYMD(currentCycleExpiry);
                            var prevType = memberObj.planType;

                            currentCycleExpiry.setDate(currentCycleExpiry.getDate() + 30);
                            var newExpStr = toLocalYMD(currentCycleExpiry);

                            memberObj.planExpiry = newExpStr;

                            var renewTimeStr = prevExp + "T10:00:00";
                            transactions.push({
                                id: "TXN-" + String(txnCounter++).padStart(6, "0"),
                                type: "monthly_plan",
                                label: planType,
                                amount: planAmount,
                                memberId: memberObj.id,
                                previousExpiry: prevExp,
                                previousPlanType: prevType,
                                paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                                time: renewTimeStr,
                                staff: staffNames[Math.floor(Math.random() * staffNames.length)]
                            });
                        } else {
                            // Missed renewal, stop cycle
                            break;
                        }
                    }
                }
            }
        }

        // Ensure at least 2 members of each of the 4 statuses exist today
        var getStatusFn = dataApi.getPlanStatus || function(m) {
            if (!m.planExpiry || m.planType === "None") return "None";
            var todayStr = toLocalYMD(now);
            if (m.planExpiry < todayStr) return "Expired";
            var cut = new Date();
            cut.setDate(cut.getDate() + 7);
            if (m.planExpiry <= toLocalYMD(cut)) return "Expiring Soon";
            return "Active";
        };

        function getStatusCounts() {
            var stCounts = { Active: [], "Expiring Soon": [], Expired: [], None: [] };
            for (var i = 0; i < members.length; i++) {
                var s = getStatusFn(members[i]);
                if (s === "None") stCounts.None.push(members[i]);
                else if (s === "Expiring Soon") stCounts["Expiring Soon"].push(members[i]);
                else if (s === "Expired") stCounts.Expired.push(members[i]);
                else stCounts.Active.push(members[i]);
            }
            return stCounts;
        }

        var stMap = getStatusCounts();

        // Ensure at least 2 "No Plan"
        while (stMap.None.length < 2 && stMap.Active.length > 2) {
            var memToClear = stMap.Active.pop();
            memToClear.monthlyPlan = "None";
            memToClear.planType = "None";
            memToClear.planExpiry = null;
            stMap.None.push(memToClear);
        }

        // Ensure at least 2 "Expiring Soon" (expiry between today and today + 5 days)
        while (stMap["Expiring Soon"].length < 2 && stMap.Active.length > 2) {
            var memToAdjust = stMap.Active.pop();
            var expSoon = new Date(now.getTime());
            expSoon.setDate(expSoon.getDate() + 2 + stMap["Expiring Soon"].length);
            memToAdjust.planExpiry = toLocalYMD(expSoon);
            stMap["Expiring Soon"].push(memToAdjust);
        }

        // Ensure at least 2 "Expired" (expiry between today - 10 days and today - 2 days)
        while (stMap.Expired.length < 2 && stMap.Active.length > 2) {
            var memToExpire = stMap.Active.pop();
            var expPast = new Date(now.getTime());
            expPast.setDate(expPast.getDate() - 3 - stMap.Expired.length);
            memToExpire.planExpiry = toLocalYMD(expPast);
            stMap.Expired.push(memToExpire);
        }

        // Ensure at least 2 "Active" (expiry > today + 15 days)
        while (stMap.Active.length < 2 && stMap.Expired.length > 2) {
            var memToActivate = stMap.Expired.pop();
            var expFuture = new Date(now.getTime());
            expFuture.setDate(expFuture.getDate() + 20);
            memToActivate.planExpiry = toLocalYMD(expFuture);
            memToActivate.planType = memToActivate.classification === "Student" ? "Student Monthly" : "Regular Monthly";
            memToActivate.monthlyPlan = memToActivate.planType;
            stMap.Active.push(memToActivate);
        }

        // Generate day passes for the last 180 days
        for (var dayOffset = 179; dayOffset >= 0; dayOffset--) {
            var dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOffset);
            var dayOfWeek = dayDate.getDay(); // 0 is Sun, 5 is Fri, 6 is Sat
            var ymdStr = toLocalYMD(dayDate);
            var isToday = dayOffset === 0;

            // 4 to 12 per day (more on Fri/Sat, fewer on Sun)
            var dayCount = 5 + Math.floor(Math.random() * 5); // 5 to 9 base
            if (dayOfWeek === 5 || dayOfWeek === 6) {
                dayCount += 2 + Math.floor(Math.random() * 2); // up to 12
            } else if (dayOfWeek === 0) {
                dayCount = Math.max(3, dayCount - 2); // fewer on Sunday
            }

            // Cap today's passes if early in the day
            if (isToday) {
                var maxHourAllowed = now.getHours();
                if (maxHourAllowed < 8) {
                    dayCount = Math.min(dayCount, 2);
                } else if (maxHourAllowed < 14) {
                    dayCount = Math.min(dayCount, 5);
                }
            }

            for (var p = 0; p < dayCount; p++) {
                var isNonMember = Math.random() < 0.65;
                var passAmount = isNonMember ? 80 : 60;
                var passType = isNonMember ? "nonmember_pass" : "member_pass";
                var passLabel = isNonMember ? "Non-Member Day Pass" : "Member Day Pass";

                var targetMemberId = null;
                if (!isNonMember) {
                    var randMember = members[Math.floor(Math.random() * members.length)];
                    targetMemberId = randMember.id;
                }

                // Time between 06:00 and 21:00 local time
                var hour = 6 + Math.floor(Math.random() * 15);
                var minute = Math.floor(Math.random() * 60);

                if (isToday) {
                    if (hour > now.getHours() || (hour === now.getHours() && minute > now.getMinutes())) {
                        hour = Math.max(6, now.getHours() - 1);
                        minute = Math.min(now.getMinutes(), Math.floor(Math.random() * 50));
                    }
                }

                var timeStr = ymdStr + "T" + String(hour).padStart(2, "0") + ":" +
                    String(minute).padStart(2, "0") + ":00";

                transactions.push({
                    id: "TXN-" + String(txnCounter++).padStart(6, "0"),
                    type: passType,
                    label: passLabel,
                    amount: passAmount,
                    memberId: targetMemberId,
                    previousExpiry: null,
                    previousPlanType: null,
                    paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
                    time: timeStr,
                    staff: staffNames[Math.floor(Math.random() * staffNames.length)]
                });
            }
        }

        // Save generated data into localStorage
        if (dataApi.saveMembers) {
            dataApi.saveMembers(members);
        } else {
            localStorage.setItem("gym_members", JSON.stringify(members));
        }

        if (dataApi.saveLog) {
            dataApi.saveLog(transactions);
        } else {
            localStorage.setItem("gym_transactions", JSON.stringify(transactions));
        }

        localStorage.setItem("gym_demo_loaded", "yes");

        // Re-render UI immediately without a full reload
        renderAll();
    }

    // 11. EVENT LISTENERS AND INITIALIZATION
    function setupEventListeners() {
        // Member growth series toggles
        var btnMemberNew = document.getElementById("btnMemberNew");
        var btnMemberTotal = document.getElementById("btnMemberTotal");

        if (btnMemberNew && btnMemberTotal) {
            btnMemberNew.addEventListener("click", function() {
                memberGrowthSeries = "new";
                btnMemberNew.classList.add("active");
                btnMemberTotal.classList.remove("active");
                var members = dataApi.loadMembers ? dataApi.loadMembers() : (JSON.parse(localStorage.getItem("gym_members")) || []);
                var transactions = dataApi.loadLog ? dataApi.loadLog() : (JSON.parse(localStorage.getItem("gym_transactions")) || []);
                var trendInfo = renderSummaryCards(members, transactions);
                renderMemberGrowth(members, trendInfo);
            });

            btnMemberTotal.addEventListener("click", function() {
                memberGrowthSeries = "total";
                btnMemberTotal.classList.add("active");
                btnMemberNew.classList.remove("active");
                var members = dataApi.loadMembers ? dataApi.loadMembers() : (JSON.parse(localStorage.getItem("gym_members")) || []);
                var transactions = dataApi.loadLog ? dataApi.loadLog() : (JSON.parse(localStorage.getItem("gym_transactions")) || []);
                var trendInfo = renderSummaryCards(members, transactions);
                renderMemberGrowth(members, trendInfo);
            });
        }

        // Revenue time range toggles
        var btnRev7 = document.getElementById("btnRev7");
        var btnRev30 = document.getElementById("btnRev30");

        if (btnRev7 && btnRev30) {
            btnRev7.addEventListener("click", function() {
                revTimeRange = 7;
                btnRev7.classList.add("active");
                btnRev30.classList.remove("active");
                var transactions = dataApi.loadLog ? dataApi.loadLog() : (JSON.parse(localStorage.getItem("gym_transactions")) || []);
                renderRevenueOverTime(transactions);
            });

            btnRev30.addEventListener("click", function() {
                revTimeRange = 30;
                btnRev30.classList.add("active");
                btnRev7.classList.remove("active");
                var transactions = dataApi.loadLog ? dataApi.loadLog() : (JSON.parse(localStorage.getItem("gym_transactions")) || []);
                renderRevenueOverTime(transactions);
            });
        }

        // Load demo data button
        var btnLoadDemo = document.getElementById("btnLoadDemo");
        if (btnLoadDemo) {
            btnLoadDemo.addEventListener("click", function() {
                if (confirm("This replaces all members and transactions with sample data. Continue?")) {
                    generateDemoData();
                }
            });
        }
    }

    // Initialize page
    setupEventListeners();
    renderAll();
})();
