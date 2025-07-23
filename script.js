// Improved script.js

let timetableData = {};
let teacherSchedule = {};
let settings = {
  lunchPeriod: 6,
  breakPeriods: [3, 9],
  totalPeriods: 10,
  maxTeacherPeriods: 30, // Arbitrary reasonable max
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
};

function showStatus(message, type = "info") {
  const status = document.getElementById("statusMessage");
  if (status) {
    status.textContent = message;
    status.className = type;
  }
}

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
      generateTimetables(parsed.data);
    } catch (err) {
      showStatus("Error reading file: " + err.message, "error");
    }
  };
  reader.readAsText(file);
}

function generateTimetables(data) {
  timetableData = {};
  teacherSchedule = {};
  let periodsPerWeekMap = {};

  // Validate & group data
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

  // Allocate subjects
  let allocationWarnings = [];
  for (const classKey in periodsPerWeekMap) {
    const subjects = periodsPerWeekMap[classKey];
    allocationWarnings.push(...allocateSubjectsToClass(classKey, subjects));
  }

  // Teacher overload check
  const overloads = Object.entries(teacherSchedule)
    .filter(([teacher, slots]) => slots.length > settings.maxTeacherPeriods)
    .map(([teacher]) => teacher);
  if (overloads.length) {
    allocationWarnings.push(
      `Warning: Teachers overloaded (>${settings.maxTeacherPeriods} periods): ${overloads.join(", ")}`
    );
  }

  renderTimetables(allocationWarnings);
}

function createEmptyTimetable() {
  const table = {};
  settings.days.forEach((day) => {
    table[day] = Array(settings.totalPeriods).fill("FREE");
    settings.breakPeriods.forEach((bp) => {
      if (bp > 0 && bp <= settings.totalPeriods) table[day][bp - 1] = "Break";
    });
    if (settings.lunchPeriod > 0 && settings.lunchPeriod <= settings.totalPeriods)
      table[day][settings.lunchPeriod - 1] = "Lunch";
  });
  return table;
}

function isLabPeriodValid(day, period) {
  // Labs require two consecutive periods, both must be FREE and not overlap lunch/break
  if (
    period >= settings.totalPeriods - 1 ||
    settings.breakPeriods.includes(period + 1) ||
    settings.lunchPeriod === period + 1
  )
    return false;
  return true;
}

function isAvailable(classKey, day, period, teacher, isLab = false) {
  if (timetableData[classKey][day][period] !== "FREE") return false;
  if (isLab) {
    if (
      !isLabPeriodValid(day, period) ||
      timetableData[classKey][day][period + 1] !== "FREE"
    )
      return false;
  }
  const slot = `${day}_${period}`;
  const nextSlot = `${day}_${period + 1}`;
  if (
    teacherSchedule[teacher]?.includes(slot) ||
    (isLab && teacherSchedule[teacher]?.includes(nextSlot))
  ) {
    return false;
  }
  return true;
}

function allocateSubjectsToClass(classKey, subjects) {
  const warnings = [];
  subjects.forEach((subjectData) => {
    let allocated = 0;
    let allocationFailed = false;
    for (let d = 0; d < settings.days.length; d++) {
      const day = settings.days[d];
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
            teacherSchedule[subjectData.teacher] = teacherSchedule[subjectData.teacher] || [];
            teacherSchedule[subjectData.teacher].push(`${day}_${p}`, `${day}_${p + 1}`);
            allocated += 2;
          }
        } else {
          if (isAvailable(classKey, day, p, subjectData.teacher)) {
            timetableData[classKey][day][p] = `${subjectData.subject} (${subjectData.teacher})`;
            teacherSchedule[subjectData.teacher] = teacherSchedule[subjectData.teacher] || [];
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

function renderTimetables(warnings = []) {
  const container = document.getElementById("timetableContainer");
  container.innerHTML = "";

  // Status messages
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
          .map(
            (day) =>
              `<td>${timetableData[classKey][day][i]}</td>`
          )
          .join("");
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    card.appendChild(table);
    container.appendChild(card);
  }
}

// UI controls for settings
function setupSettingsUI() {
  const breaksInput = document.getElementById("breakPeriodsInput");
  const lunchInput = document.getElementById("lunchPeriodInput");
  const totalPeriodsInput = document.getElementById("totalPeriodsInput");

  if (breaksInput) {
    breaksInput.value = settings.breakPeriods.join(",");
    breaksInput.addEventListener("change", (e) => {
      settings.breakPeriods = e.target.value
        .split(",")
        .map((v) => parseInt(v.trim()))
        .filter((v) => !isNaN(v));
    });
  }
  if (lunchInput) {
    lunchInput.value = settings.lunchPeriod;
    lunchInput.addEventListener("change", (e) => {
      settings.lunchPeriod = parseInt(e.target.value);
    });
  }
  if (totalPeriodsInput) {
    totalPeriodsInput.value = settings.totalPeriods;
    totalPeriodsInput.addEventListener("change", (e) => {
      settings.totalPeriods = parseInt(e.target.value);
    });
  }
}

document.getElementById("csvUpload").addEventListener("change", handleFileUpload);
setupSettingsUI();
