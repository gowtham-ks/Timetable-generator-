let subjects = [];

function loadCSV() {
  const file = document.getElementById("csvInput").files[0];

  if (!file) {
    alert("Please select a CSV file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    const text = e.target.result;
    const rows = text.trim().split("\n");

    subjects = rows.slice(1).map((row) => {
      const [subject, teacher, periods] = row.split(",");
      return {
        subject: subject.trim(),
        teacher: teacher.trim(),
        periods: parseInt(periods.trim())
      };
    });

    generateTimetable();
  };

  reader.readAsText(file);
}

function generateTimetable() {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const periodsPerDay = 6;
  const totalSlots = days.length * periodsPerDay;

  // Flatten subjects into a pool of [subject, teacher] repeated by required periods
  let subjectPool = [];

  subjects.forEach((item) => {
    for (let i = 0; i < item.periods; i++) {
      subjectPool.push({
        subject: item.subject,
        teacher: item.teacher
      });
    }
  });

  // Fill remaining slots if needed
  while (subjectPool.length < totalSlots) {
    subjectPool.push({
      subject: "Free Period",
      teacher: ""
    });
  }

  // Shuffle the pool randomly
  shuffleArray(subjectPool);

  // Generate timetable
  const timetable = [];

  let k = 0;
  for (let i = 0; i < days.length; i++) {
    const daySchedule = [];
    for (let j = 0; j < periodsPerDay; j++) {
      const entry = subjectPool[k++];

      daySchedule.push({
        subject: entry.subject,
        teacher: entry.teacher
      });
    }
    timetable.push(daySchedule);
  }

  renderTimetable(days, periodsPerDay, timetable);
}

function renderTimetable(days, periodsPerDay, timetable) {
  let html = "<table border='1'>";
  html += "<tr><th>Day</th>";

  for (let i = 1; i <= periodsPerDay; i++) {
    html += `<th>Period ${i}</th>`;
  }
  html += "</tr>";

  for (let i = 0; i < days.length; i++) {
    html += `<tr><td>${days[i]}</td>`;
    for (let j = 0; j < periodsPerDay; j++) {
      const entry = timetable[i][j];
      html += `<td><strong>${entry.subject}</strong><br /><span style="font-size:0.9em;color:#555">${entry.teacher}</span></td>`;
    }
    html += "</tr>";
  }

  html += "</table>";

  document.getElementById("timetable-container").innerHTML = html;
}

// Utility: Shuffle array in place
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
