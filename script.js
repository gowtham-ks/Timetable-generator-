// Timetable Generator JS

let timetableData = {};
let teacherSchedule = {};
let parsedCSVData = [];
let settings = {
  lunchPeriod: 6,
  breakPeriods: [3, 9],
  totalPeriods: 10,
  maxTeacherPeriods: 30,
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

// UI STATUS
function showStatus(message, type = "info") {
  const status = document.getElementById("statusMessage");
  if (status) {
    status.textContent = message;
    status.className = type;
  }
}

// Read dynamic settings
function readSettingsFromUI() {
  const breaksInput = document.getElementById("breakPeriodsInput");
  const lunchInput = document.getElementById("lunchPeriodInput");
  const totalPeriodsInput = document.getElementById("totalPeriodsInput");

  if (breaksInput) {
    settings.breakPeriods = breaksInput.value
      .split(",")
      .map((v) => parseInt(v.trim()))
      .filter((v) => !isNaN(v));
  }
  if (lunchInput) {
    settings.lunchPeriod = parseInt(lunchInput.value) || 6;
  }
  if (totalPeriodsInput) {
    settings.totalPeriods = parseInt(totalPeriodsInput.value) || 10;
  }
}

// Handle CSV Upload
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) {
    showStatus("No file selected.", "error");
    return;
  }

  showStatus("Uploading...");

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const text = e.target.result;
      const parsed = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
      });

      if (parsed.errors.length) {
        showStatus("CSV parse error: " + parsed.errors[0].message, "error");
        return;
      }

      parsedCSVData = parsed.data;
      generateTimetables(parsedCSVData);
    } catch (err) {
      showStatus("Error reading file: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}

// Main timetable generation
function generateTimetables(data) {
  readSettingsFromUI();
  timetableData = {};
  teacherSchedule = {};
  const periodsPerWeekMap = {};

  // Validate & group
  for (const row of data) {
    if (
      !row.Department ||
      !row.Year ||
      !row.Section ||
      !row.Subject ||
      !row.Teacher ||
      isNaN(parseInt(row.PeriodsPerWeek)) ||
      !row.Type
    ) {
      showStatus("Invalid row detected. Please check your CSV.", "error");
      return;
    }

    const key = `${row.Department}_${row.Year}_${row.Section}`;
    if (!timetableData[key]) timetableData[key] = createEmptyTimetable();
    if (!periodsPerWeekMap[key]) periodsPerWeekMap[key] = [];

    periodsPerWeekMap[key].push({
      subject: row.Subject,
      teacher: row.Teacher,
      periods: parseInt(row.PeriodsPerWeek),
      isLab: row.Type.toLowerCase() === "lab",
    });
  }

  // Allocation
  const allocationWarnings = [];
  for (const classKey in periodsPerWeekMap) {
    const subjects = periodsPerWeekMap[classKey];
    allocationWarnings.push(...allocateSubjectsToClass(classKey, subjects));
  }

  // Teacher overload check
  const overloads = Object.entries(teacherSchedule)
    .filter(([_, slots]) => slots.length > settings.maxTeacherPeriods)
    .map(([teacher]) => teacher);

  if (overloads.length) {
    allocationWarnings.push(
      `⚠️ Teachers overloaded (> ${settings.maxTeacherPeriods} periods): ${overloads.join(", ")}`
    );
  }

  renderTimetables(allocationWarnings);
}

// Create blank timetable
function createEmptyTimetable() {
  const table = {};
  settings.days.forEach((day) => {
    table[day] = Array(settings.totalPeriods).fill("FREE");

    settings.breakPeriods.forEach((bp) => {
      if (bp > 0 && bp <= settings.totalPeriods) table[day][bp - 1] = "Break";
    });

    if (
      settings.lunchPeriod > 0 &&
      settings.lunchPeriod <= settings.totalPeriods
    ) {
      table[day][settings.lunchPeriod - 1] = "Lunch";
    }
  });
  return table;
}

// Check lab validity
function isLabPeriodValid(day, period) {
  return (
    period < settings.totalPeriods - 1 &&
    !settings.breakPeriods.includes(period + 1) &&
    settings.lunchPeriod !== period + 1
  );
}

// Check slot availability
function isAvailable(classKey, day, period, teacher, isLab = false) {
  if (timetableData[classKey][day][period] !== "FREE") return false;

  if (isLab) {
    if (
      !isLabPeriodValid(day, period) ||
      timetableData[classKey][day][period + 1] !== "FREE"
    ) {
      return false;
    }
  }

  const slot = `${day}_${period}`;
  const nextSlot = `${day}_${period + 1}`;
  const teacherSlots = teacherSchedule[teacher] || [];

  if (
    teacherSlots.includes(slot) ||
    (isLab && teacherSlots.includes(nextSlot))
  ) {
    return false;
  }

  return true;
}

// Allocate subjects
function allocateSubjectsToClass(classKey, subjects) {
  const warnings = [];

  subjects.forEach((subjectData) => {
    let allocated = 0;

    for (const day of settings.days) {
      for (let p = 0; p < settings.totalPeriods; p++) {
        if (
          settings.breakPeriods.includes(p + 1) ||
          p + 1 === settings.lunchPeriod
        )
          continue;

        if (subjectData.isLab) {
          if (isAvailable(classKey, day, p, subjectData.teacher, true)) {
            timetableData[classKey][day][p] = `${subjectData.subject} LAB (${subjectData.teacher})`;
            timetableData[classKey][day][p + 1] = `${subjectData.subject} LAB (${subjectData.teacher})`;
            teacherSchedule[subjectData.teacher] =
              teacherSchedule[subjectData.teacher] || [];
            teacherSchedule[subjectData.teacher].push(
              `${day}_${p}`,
              `${day}_${p + 1}`
            );
            allocated += 2;
          }
        } else {
          if (isAvailable(classKey, day, p, subjectData.teacher)) {
            timetableData[classKey][day][p] = `${subjectData.subject} (${subjectData.teacher})`;
            teacherSchedule[subjectData.teacher] =
              teacherSchedule[subjectData.teacher] || [];
            teacherSchedule[subjectData.teacher].push(`${day}_${p}`);
            allocated++;
          }
        }

        if (allocated >= subjectData.periods) break;
      }
      if (allocated >= subjectData.periods) break;
    }

    if (allocated < subjectData.periods) {
      warnings.push(
        `Could not allocate all periods for ${subjectData.subject} (${subjectData.teacher}) in ${classKey}.`
      );
    }
  });

  return warnings;
}

// Render timetable to HTML
function renderTimetables(warnings = []) {
  const container = document.getElementById("timetableContainer");
  container.innerHTML = "";

  if (warnings.length) {
    const warningDiv = document.createElement("div");
    warningDiv.className = "warning";
    warningDiv.innerHTML = warnings.map((w) => `<p>${w}</p>`).join("");
    container.appendChild(warningDiv);
    showStatus("Timetable generated with warnings.", "warn");
  } else {
    showStatus("Timetable generated successfully!", "success");
  }

  for (const classKey in timetableData) {
    const [dept, year, section] = classKey.split("_");

    const card = document.createElement("section");
    card.className = "timetable-card";
    card.innerHTML = `<h2>${dept} - ${year} - ${section}</h2>`;

    const table = document.createElement("table");
    table.setAttribute("role", "table");

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML =
      `<th scope="col">Period</th>` +
      settings.days.map((d) => `<th scope="col">${d}</th>`).join("");
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < settings.totalPeriods; i++) {
      const row = document.createElement("tr");
      row.innerHTML =
        `<th scope="row">Period ${i + 1}</th>` +
        settings.days
          .map((day) => `<td>${timetableData[classKey][day][i]}</td>`)
          .join("");
      tbody.appendChild(row);
    }

    table.appendChild(tbody);
    card.appendChild(table);
    container.appendChild(card);
  }
}

// Settings UI bindings
function setupSettingsUI() {
  document
    .getElementById("breakPeriodsInput")
    ?.addEventListener("change", readSettingsFromUI);
  document
    .getElementById("lunchPeriodInput")
    ?.addEventListener("change", readSettingsFromUI);
  document
    .getElementById("totalPeriodsInput")
    ?.addEventListener("change", readSettingsFromUI);
}

// Trigger upload
document.getElementById("csvUpload").addEventListener("change", handleFileUpload);

// Manual generate
document.getElementById("generateBtn").addEventListener("click", () => {
  if (!parsedCSVData.length) {
    showStatus("Please upload a CSV file before generating!", "error");
    return;
  }
  generateTimetables(parsedCSVData);
});

// Init
setupSettingsUI();
