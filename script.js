function generateTimetable() {
  const subjectsInput = document.getElementById("subjects").value;

  // 📌 Trim input and split by comma, filter out empty items
  const subjectList = subjectsInput
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const periodsPerDay = 6;

  const timetable = [];

  for (let i = 0; i < days.length; i++) {
    const daySchedule = [];
    for (let j = 0; j < periodsPerDay; j++) {
      if (subjectList.length > 0) {
        // ✅ Assign a random subject instead of "Free Period"
        const subjectIndex = Math.floor(Math.random() * subjectList.length);
        daySchedule.push(subjectList[subjectIndex]);
      } else {
        // If no subjects provided, show "Free Period"
        daySchedule.push("Free Period");
      }
    }
    timetable.push(daySchedule);
  }

  renderTimetable(days, periodsPerDay, timetable);
}

function renderTimetable(days, periodsPerDay, timetable) {
  let html = "<table>";
  html += "<tr><th>Day</th>";

  for (let i = 1; i <= periodsPerDay; i++) {
    html += `<th>Period ${i}</th>`;
  }
  html += "</tr>";

  for (let i = 0; i < days.length; i++) {
    html += `<tr><td>${days[i]}</td>`;
    for (let j = 0; j < periodsPerDay; j++) {
      html += `<td>${timetable[i][j]}</td>`;
    }
    html += "</tr>";
  }

  html += "</table>";

  document.getElementById("timetable-container").innerHTML = html;
}
