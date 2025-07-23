// script.js

let timetableData = {};
let teacherSchedule = {};

const lunchPeriod = 6;
const breakPeriods = [3, 9];
const totalPeriods = 10;
const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    const parsedData = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    }).data;
    generateTimetables(parsedData);
  };
  reader.readAsText(file);
}

function generateTimetables(data) {
  timetableData = {};
  teacherSchedule = {};

  const periodsPerWeekMap = {};
  data.forEach((row) => {
    const key = `${row.Department}_${row.Year}_${row.Section}`;
    if (!timetableData[key]) {
      timetableData[key] = createEmptyTimetable();
    }
    if (!periodsPerWeekMap[key]) {
      periodsPerWeekMap[key] = [];
    }
    periodsPerWeekMap[key].push({
      subject: row.Subject,
      teacher: row.Teacher,
      periods: parseInt(row.PeriodsPerWeek),
      isLab: row.Type.toLowerCase() === "lab",
    });
  });

  for (const classKey in periodsPerWeekMap) {
    const subjects = periodsPerWeekMap[classKey];
    allocateSubjectsToClass(classKey, subjects);
  }

  renderTimetables();
}

function createEmptyTimetable() {
  const table = {};
  days.forEach((day) => {
    table[day] = Array(totalPeriods).fill("FREE");
    if (breakPeriods.includes(3)) table[day][2] = "Break";
    if (breakPeriods.includes(9)) table[day][8] = "Break";
    table[day][lunchPeriod - 1] = "Lunch";
  });
  return table;
}

function isAvailable(classKey, day, period, teacher, isLab = false) {
  if (isLab && period >= totalPeriods - 1) return false;
  if (timetableData[classKey][day][period] !== "FREE") return false;
  if (isLab && timetableData[classKey][day][period + 1] !== "FREE") return false;

  for (const otherClass in timetableData) {
    const slot = `${day}_${period}`;
    const nextSlot = `${day}_${period + 1}`;
    if (
      teacherSchedule[teacher]?.includes(slot) ||
      (isLab && teacherSchedule[teacher]?.includes(nextSlot))
    ) {
      return false;
    }
  }
  return true;
}

function allocateSubjectsToClass(classKey, subjects) {
  subjects.forEach((subjectData) => {
    let allocated = 0;
    for (let d = 0; d < days.length; d++) {
      const day = days[d];
      for (let p = 0; p < totalPeriods; p++) {
        if (breakPeriods.includes(p + 1) || p + 1 === lunchPeriod) continue;

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
  });
}

function renderTimetables() {
  const container = document.getElementById("timetableContainer");
  container.innerHTML = "";

  for (const classKey in timetableData) {
    const [dept, year, section] = classKey.split("_");
    const card = document.createElement("div");
    card.className = "timetable-card";
    card.innerHTML = `<h2>${dept} - ${year} - ${section}</h2>`;

    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>Period</th>` + days.map((d) => `<th>${d}</th>`).join("");
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (let i = 0; i < totalPeriods; i++) {
      const row = document.createElement("tr");
      row.innerHTML = `<td>Period ${i + 1}</td>` +
        days.map((day) => `<td>${timetableData[classKey][day][i]}</td>`).join("");
      tbody.appendChild(row);
    }
    table.appendChild(tbody);
    card.appendChild(table);
    container.appendChild(card);
  }
}

document.getElementById("csvUpload").addEventListener("change", handleFileUpload);
