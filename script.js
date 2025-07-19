let csvData = [];

function generateTimetable() {
  const fileInput = document.getElementById("csvFile");
  if (!fileInput.files.length) {
    alert("Please upload a CSV file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    const text = e.target.result;
    parseCSV(text);
  };
  reader.readAsText(fileInput.files[0]);
}

function parseCSV(data) {
  const rows = data.trim().split("\n").map(row => row.split(","));
  const headers = rows.shift();
  csvData = rows.map(row =>
    row.reduce((acc, val, i) => {
      acc[headers[i]] = val.trim();
      return acc;
    }, {})
  );

  createTimetableUI(generateLogic(csvData));
}

function generateLogic(data) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const timetable = {};
  const totalPeriods = 10;
  const teachingPeriods = 7;
  const breakIndices = [2, 4, 9]; // Period 3: Interval, Period 5: Lunch, Period 10: Break

  days.forEach(day => {
    timetable[day] = Array(totalPeriods).fill("FREE");
  });

  const usedLabs = {};

  for (let i = 0; i < teachingPeriods * days.length && data.length; i++) {
    const day = days[i % days.length];
    for (let period = 0; period < totalPeriods; period++) {
      if (breakIndices.includes(period)) {
        timetable[day][period] = period === 4 ? "Lunch" : "Interval";
      } else {
        const subject = data.shift();
        if (!subject) break;
        const key = `${subject.Class}_${period}`;

        if (subject.Type === "Lab" && usedLabs[key]) {
          data.push(subject); // Retry later
          continue;
        }

        if (subject.Type === "Lab") usedLabs[key] = true;
        timetable[day][period] = `${subject.Subject}\n${subject.Teacher}`;
      }
    }
  }

  return timetable;
}

function createTimetableUI(timetable) {
  let html = `<table><thead><tr><th>Period</th>`;
  Object.keys(timetable).forEach(day => {
    html += `<th>${day}</th>`;
  });
  html += "</tr></thead><tbody>";

  for (let i = 0; i < 10; i++) {
    html += `<tr><td>Period ${i + 1}</td>`;
    for (const day in timetable) {
      html += `<td>${timetable[day][i]}</td>`;
    }
    html += "</tr>";
  }

  html += "</tbody></table>";
  document.getElementById("timetableOutput").innerHTML = html;
}

function downloadAsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Timetable", 14, 16);
  doc.autoTable({ html: 'table', startY: 20 });
  doc.save("timetable.pdf");
}

function downloadAsExcel() {
  const ws = XLSX.utils.table_to_sheet(document.querySelector("table"));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Timetable");
  XLSX.writeFile(wb, "timetable.xlsx");
}
