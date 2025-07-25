class TimetableGenerator {
  constructor() {
    this.timetableData = {};
    this.teacherSchedule = {};
    this.roomSchedule = {};
    this.csvData = null;
    this.settings = {
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
      lunchPeriod: 6,
      breakPeriods: [3, 9],
      totalPeriods: 10,
      maxTeacherPeriods: 30
    };
    this.stats = {
      totalClasses: 0,
      totalSubjects: 0,
      totalTeachers: 0,
      allocationSuccess: 0
    };
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    document.getElementById('csvUpload').addEventListener('change', (e) => this.handleFileUpload(e));
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateTimetables());
    }
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportTimetables());
    }
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearAll());
    }
    ['totalPeriodsInput', 'lunchPeriodInput', 'breakPeriodsInput', 'maxTeacherPeriodsInput'].forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.updateSettings());
      }
    });
    this.addMobileEventListeners();
  }

  addMobileEventListeners() {
    document.addEventListener('touchstart', (e) => {
      if (e.target.classList.contains('timetable-cell')) {
        e.target.style.backgroundColor = '#e3f2fd';
      }
    });
    document.addEventListener('touchend', (e) => {
      if (e.target.classList.contains('timetable-cell')) {
        setTimeout(() => {
          e.target.style.backgroundColor = '';
        }, 150);
      }
    });
    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.adjustMobileLayout(), 100);
    });
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.adjustMobileLayout(), 250);
    });
  }

  adjustMobileLayout() {
    const isMobile = window.innerWidth <= 768;
    const tables = document.querySelectorAll('.timetable');
    tables.forEach(table => {
      if (isMobile) {
        table.style.fontSize = '0.7rem';
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.style.padding = '0.3rem 0.1rem';
        });
      } else {
        table.style.fontSize = '';
        const cells = table.querySelectorAll('td, th');
        cells.forEach(cell => {
          cell.style.padding = '';
        });
      }
    });
  }

  showStatus(message, type = "info") {
    const status = document.getElementById("statusMessage");
    if (status) {
      const statusClass = type === 'success' ? 'success' :
                         type === 'error' ? 'error' :
                         type === 'warn' ? 'warn' : 'info';
      status.innerHTML = `<div class="status ${statusClass}">${message}</div>`;
      if (type === 'success') {
        setTimeout(() => {
          status.innerHTML = '';
        }, 3000);
      }
      if (window.innerWidth <= 768) {
        status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  showLoading(show = true) {
    const container = document.getElementById("timetableContainer");
    if (show) {
      container.innerHTML = `
        <div class="loading" style="text-align: center; padding: 2rem;">
          <div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
          <p>Generating optimized timetables...</p>
        </div>
      `;
    }
  }

  updateSettings() {
    const breaksInput = document.getElementById("breakPeriodsInput");
    const lunchInput = document.getElementById("lunchPeriodInput");
    const totalPeriodsInput = document.getElementById("totalPeriodsInput");
    const maxTeacherPeriodsInput = document.getElementById("maxTeacherPeriodsInput");
    if (breaksInput) {
      this.settings.breakPeriods = breaksInput.value
        .split(",")
        .map(v => parseInt(v.trim()))
        .filter(v => !isNaN(v) && v > 0);
    }
    if (lunchInput) {
      this.settings.lunchPeriod = parseInt(lunchInput.value) || 6;
    }
    if (totalPeriodsInput) {
      this.settings.totalPeriods = parseInt(totalPeriodsInput.value) || 10;
    }
    if (maxTeacherPeriodsInput) {
      this.settings.maxTeacherPeriods = parseInt(maxTeacherPeriodsInput.value) || 30;
    }
    if (this.settings.lunchPeriod > this.settings.totalPeriods) {
      this.showStatus("Lunch period cannot exceed total periods!", "error");
      if (lunchInput) {
        lunchInput.value = Math.min(this.settings.lunchPeriod, this.settings.totalPeriods);
        this.settings.lunchPeriod = parseInt(lunchInput.value);
      }
    }
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
      this.showStatus("No file selected.", "error");
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.showStatus("Please select a CSV file.", "error");
      return;
    }
    this.showStatus("Reading CSV file...", "info");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          delimiter: ",",
          delimitersToGuess: [',', '\t', '|', ';']
        });
        if (parsed.errors.length > 0) {
          this.showStatus(`CSV parse error: ${parsed.errors[0].message}`, "error");
          return;
        }
        if (parsed.data.length === 0) {
          this.showStatus("CSV file is empty or has no valid data.", "error");
          return;
        }
        const requiredColumns = ['Department', 'Year', 'Section', 'Subject', 'Teacher', 'PeriodsPerWeek', 'Type'];
        const headers = Object.keys(parsed.data[0]);
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));
        if (missingColumns.length > 0) {
          this.showStatus(`Missing required columns: ${missingColumns.join(', ')}`, "error");
          return;
        }
        this.csvData = parsed.data;
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.disabled = false;
        this.showStatus(`CSV loaded successfully! ${parsed.data.length} entries found.`, "success");
        const label = document.querySelector('.file-upload-label');
        if (label) {
          label.textContent = `✓ ${file.name}`;
        }
      } catch (err) {
        this.showStatus(`Error reading file: ${err.message}`, "error");
      }
    };
    reader.readAsText(file);
  }

  validateData(data) {
    const errors = [];
    const warnings = [];
    data.forEach((row, index) => {
      const rowNum = index + 2;
      if (!row.Department?.toString().trim()) errors.push(`Row ${rowNum}: Department is required`);
      if (!row.Year) errors.push(`Row ${rowNum}: Year is required`);
      if (!row.Section?.toString().trim()) errors.push(`Row ${rowNum}: Section is required`);
      if (!row.Subject?.toString().trim()) errors.push(`Row ${rowNum}: Subject is required`);
      if (!row.Teacher?.toString().trim()) errors.push(`Row ${rowNum}: Teacher is required`);
      if (!row.Type?.toString().trim()) errors.push(`Row ${rowNum}: Type is required`);
      const periods = parseInt(row.PeriodsPerWeek);
      if (isNaN(periods) || periods <= 0) {
        errors.push(`Row ${rowNum}: PeriodsPerWeek must be a positive number`);
      } else if (periods > this.settings.totalPeriods * this.settings.days.length) {
        warnings.push(`Row ${rowNum}: ${periods} periods/week may be too many to schedule`);
      }
      if (row.Type && !['theory', 'lab', 'practical'].includes(row.Type.toString().toLowerCase())) {
        warnings.push(`Row ${rowNum}: Type should be 'theory', 'lab', or 'practical'`);
      }
    });
    return { errors, warnings };
  }

  generateTimetables() {
    if (!this.csvData) {
      this.showStatus("Please upload a CSV file first.", "error");
      return;
    }
    this.showLoading(true);
    this.updateSettings();
    const validation = this.validateData(this.csvData);
    if (validation.errors.length > 0) {
      this.showStatus(`Data validation failed:<br>${validation.errors.join('<br>')}`, "error");
      document.getElementById("timetableContainer").innerHTML = '';
      return;
    }
    setTimeout(() => {
      try {
        this.processData();
      } catch (error) {
        this.showStatus(`Generation failed: ${error.message}`, "error");
        document.getElementById("timetableContainer").innerHTML = '';
      }
    }, 100);
  }

  processData() {
    this.timetableData = {};
    this.teacherSchedule = {};
    this.roomSchedule = {};
    const periodsPerWeekMap = {};
    const teacherWorkload = {};
    this.csvData.forEach(row => {
      const classKey = `${row.Department}_${row.Year}_${row.Section}`;
      if (!this.timetableData[classKey]) {
        this.timetableData[classKey] = this.createEmptyTimetable();
      }
      if (!periodsPerWeekMap[classKey]) {
        periodsPerWeekMap[classKey] = [];
      }
      const periods = parseInt(row.PeriodsPerWeek);
      const isLab = row.Type.toString().toLowerCase() === 'lab';
      periodsPerWeekMap[classKey].push({
        subject: row.Subject.toString().trim(),
        teacher: row.Teacher.toString().trim(),
        periods: periods,
        isLab: isLab,
        priority: isLab ? 1 : 2
      });
      const teacherName = row.Teacher.toString().trim();
      if (!teacherWorkload[teacherName]) {
        teacherWorkload[teacherName] = 0;
      }
      teacherWorkload[teacherName] += periods;
    });
    const overloadedTeachers = Object.entries(teacherWorkload)
      .filter(([_, load]) => load > this.settings.maxTeacherPeriods)
      .map(([teacher, load]) => `${teacher} (${load} periods)`);
    let allocationWarnings = [];
    if (overloadedTeachers.length > 0) {
      allocationWarnings.push(
        `⚠️ Teachers with excessive workload: ${overloadedTeachers.join(', ')}`
      );
    }
    let totalAllocated = 0;
    let totalRequired = 0;
    for (const classKey in periodsPerWeekMap) {
      const subjects = this.prioritizeSubjects(periodsPerWeekMap[classKey]);
      const result = this.allocateSubjectsToClass(classKey, subjects);
      allocationWarnings.push(...result.warnings);
      totalAllocated += result.allocated;
      totalRequired += result.required;
    }
    this.stats = {
      totalClasses: Object.keys(this.timetableData).length,
      totalSubjects: this.csvData.length,
      totalTeachers: Object.keys(teacherWorkload).length,
      allocationSuccess: totalRequired > 0 ? Math.round((totalAllocated / totalRequired) * 100) : 0
    };
    this.renderTimetables(allocationWarnings);
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.disabled = false;
  }

  createEmptyTimetable() {
    const table = {};
    this.settings.days.forEach(day => {
      table[day] = Array(this.settings.totalPeriods).fill("FREE");
      this.settings.breakPeriods.forEach(bp => {
        if (bp > 0 && bp <= this.settings.totalPeriods) {
          table[day][bp - 1] = "Break";
        }
      });
      if (this.settings.lunchPeriod > 0 && this.settings.lunchPeriod <= this.settings.totalPeriods) {
        table[day][this.settings.lunchPeriod - 1] = "Lunch";
      }
    });
    return table;
  }

  prioritizeSubjects(subjects) {
    return subjects.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return b.periods - a.periods;
    });
  }

  isSlotAvailable(classKey, day, period, teacher, isLab = false) {
    if (this.timetableData[classKey][day][period] !== "FREE") return false;
    if (isLab) {
      if (period >= this.settings.totalPeriods - 1) return false;
      if (this.timetableData[classKey][day][period + 1] !== "FREE") return false;
      if (this.settings.breakPeriods.includes(period + 2) ||
          this.settings.lunchPeriod === period + 2) return false;
    }
    const slot = `${day}_${period}`;
    const teacherSlots = this.teacherSchedule[teacher] || [];
    if (teacherSlots.includes(slot)) return false;
    if (isLab) {
      const nextSlot = `${day}_${period + 1}`;
      if (teacherSlots.includes(nextSlot)) return false;
    }
    return true;
  }

  allocateSubjectsToClass(classKey, subjects) {
    const warnings = [];
    let totalAllocated = 0;
    let totalRequired = 0;
    subjects.forEach(subjectData => {
      let allocated = 0;
      const maxAttempts = 5000;
      let attempts = 0;
      totalRequired += subjectData.periods;
      while (allocated < subjectData.periods && attempts < maxAttempts) {
        attempts++;
        const dayIndex = this.getWeightedRandomDay(classKey, subjectData.teacher);
        const day = this.settings.days[dayIndex];
        const period = this.getRandomAvailablePeriod(classKey, day, subjectData.isLab);
        if (period === -1 || !this.isSlotAvailable(classKey, day, period, subjectData.teacher, subjectData.isLab)) {
          continue;
        }
        if (subjectData.isLab) {
          const labLabel = `${subjectData.subject} LAB (${subjectData.teacher})`;
          this.timetableData[classKey][day][period] = labLabel;
          this.timetableData[classKey][day][period + 1] = labLabel;
          if (!this.teacherSchedule[subjectData.teacher]) {
            this.teacherSchedule[subjectData.teacher] = [];
          }
          this.teacherSchedule[subjectData.teacher].push(`${day}_${period}`, `${day}_${period + 1}`);
          allocated += 2;
        } else {
          this.timetableData[classKey][day][period] = `${subjectData.subject} (${subjectData.teacher})`;
          if (!this.teacherSchedule[subjectData.teacher]) {
            this.teacherSchedule[subjectData.teacher] = [];
          }
          this.teacherSchedule[subjectData.teacher].push(`${day}_${period}`);
          allocated += 1;
        }
      }
      totalAllocated += allocated;
      if (allocated < subjectData.periods) {
        const shortage = subjectData.periods - allocated;
        warnings.push(
          `⚠️ ${classKey}: Could not allocate ${shortage} period(s) for ${subjectData.subject} (${subjectData.teacher})`
        );
      }
    });
    return {
      warnings,
      allocated: totalAllocated,
      required: totalRequired
    };
  }

  getWeightedRandomDay(classKey, teacher) {
    const weights = this.settings.days.map((day, index) => {
      const daySlots = this.timetableData[classKey][day];
      const freeSlots = daySlots.filter(slot => slot === "FREE").length;
      return Math.max(1, freeSlots);
    });
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      random -= weights[i];
      if (random <= 0) return i;
    }
    return Math.floor(Math.random() * this.settings.days.length);
  }

  getRandomAvailablePeriod(classKey, day, isLab) {
    const daySchedule = this.timetableData[classKey][day];
    const availablePeriods = [];
    for (let i = 0; i < this.settings.totalPeriods; i++) {
      if (daySchedule[i] === "FREE") {
        if (isLab) {
          if (i < this.settings.totalPeriods - 1 && daySchedule[i + 1] === "FREE") {
            availablePeriods.push(i);
          }
        } else {
          availablePeriods.push(i);
        }
      }
    }
    return availablePeriods.length > 0 ?
           availablePeriods[Math.floor(Math.random() * availablePeriods.length)] : -1;
  }

  getCellClass(content) {
    if (content === "FREE") return "free-cell";
    if (content === "Break") return "break-cell";
    if (content === "Lunch") return "lunch-cell";
    if (content.includes("LAB")) return "lab-cell";
    return "subject-cell";
  }

  renderTimetables(warnings = []) {
    const container = document.getElementById("timetableContainer");
    container.innerHTML = "";
    if (warnings.length) {
      const warningDiv = document.createElement("div");
      warningDiv.className = "warning";
      warningDiv.style.cssText = `
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 10px;
        padding: 1rem;
        margin-bottom: 1rem;
      `;
      warningDiv.innerHTML = warnings.map(w => `<p style="margin-bottom: 0.5rem; color: #856404;">${w}</p>`).join("");
      container.appendChild(warningDiv);
      this.showStatus("Timetable generated with warnings.", "warn");
    } else {
      this.showStatus("Timetable generated successfully!", "success");
    }
    this.renderStats(container);
    for (const classKey in this.timetableData) {
      const [dept, year, section] = classKey.split("_");
      const card = document.createElement("section");
      card.className = "timetable-card";
      card.style.cssText = `
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        padding: 1.5rem;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        overflow: hidden;
        margin-bottom: 2rem;
      `;
      const header = document.createElement("h2");
      header.textContent = `${dept} - ${year} - ${section}`;
      header.style.cssText = `
        color: #667eea;
        margin-bottom: 1rem;
        text-align: center;
        font-size: clamp(1.2rem, 3vw, 1.8rem);
      `;
      card.appendChild(header);
      const wrapper = document.createElement("div");
      wrapper.className = "timetable-wrapper";
      wrapper.style.cssText = `
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      `;
      const table = document.createElement("table");
      table.className = "timetable";
      table.setAttribute("role", "table");
      table.style.cssText = `
        width: 100%;
        border-collapse: collapse;
        min-width: 600px;
        background: white;
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      `;
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headerRow.innerHTML = `<th scope="col" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 0.75rem 0.5rem; text-align: center; font-weight: 600; font-size: 0.9rem;">Period</th>` +
        this.settings.days.map(d => `<th scope="col" style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 0.75rem 0.5rem; text-align: center; font-weight: 600; font-size: 0.9rem;">${d}</th>`).join("");
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = document.createElement("tbody");
      for (let i = 0; i < this.settings.totalPeriods; i++) {
        const row = document.createElement("tr");
        if (i % 2 === 1) {
          row.style.background = "#f8f9fa";
        }
        row.innerHTML = `<th scope="row" class="period-header" style="background: #f8f9fa !important; color: #333 !important; font-weight: 600; border-right: 2px solid #dee2e6; padding: 0.5rem; text-align: center; font-size: 0.8rem;">Period ${i + 1}</th>` +
          this.settings.days.map(day => {
            const content = this.timetableData[classKey][day][i];
            const cellClass = this.getCellClass(content);
            let cellStyle = "padding: 0.5rem; text-align: center; border-bottom: 1px solid #f0f0f0; font-size: 0.8rem; line-height: 1.3; vertical-align: middle;";
            if (cellClass === "break-cell") {
              cellStyle += " background: #fff3cd !important; color: #856404; font-weight: 600;";
            } else if (cellClass === "lunch-cell") {
              cellStyle += " background: #d4edda !important; color: #155724; font-weight: 600;";
            } else if (cellClass === "free-cell") {
              cellStyle += " background: #f8f9fa !important; color: #6c757d; font-style: italic;";
            } else if (cellClass === "lab-cell") {
              cellStyle += " background: #e3f2fd !important; color: #1565c0; font-weight: 600;";
            } else {
              cellStyle += " font-weight: 500; color: #495057;";
            }
            return `<td class="${cellClass} timetable-cell" style="${cellStyle}">${content}</td>`;
          }).join("");
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      wrapper.appendChild(table);
      card.appendChild(wrapper);
      container.appendChild(card);
    }
    setTimeout(() => this.adjustMobileLayout(), 100);
  }

  renderStats(container) {
    const statsDiv = document.createElement("div");
    statsDiv.className = "stats";
    statsDiv.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    `;
    const stats = [
      { label: "Classes", value: this.stats.totalClasses },
      { label: "Subjects", value: this.stats.totalSubjects },
      { label: "Teachers", value: this.stats.totalTeachers },
      { label: "Success Rate", value: `${this.stats.allocationSuccess}%` }
    ];
    stats.forEach(stat => {
      const card = document.createElement("div");
      card.className = "stat-card";
      card.style.cssText = `
        background: rgba(255, 255, 255, 0.9);
        padding: 1rem;
        border-radius: 10px;
        text-align: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      `;
      card.innerHTML = `
        <div class="stat-value" style="font-size: 1.5rem; font-weight: bold; color: #667eea;">${stat.value}</div>
        <div class="stat-label" style="font-size: 0.9rem; color: #666; margin-top: 0.25rem;">${stat.label}</div>
      `;
      statsDiv.appendChild(card);
    });
    container.appendChild(statsDiv);
  }

  exportTimetables() {
    if (!this.timetableData || Object.keys(this.timetableData).length === 0) {
      this.showStatus("No timetable data to export.", "error");
      return;
    }
    let csvContent = "Class,Day,Period,Subject\n";
    for (const classKey in this.timetableData) {
      const [dept, year, section] = classKey.split("_");
      const className = `${dept}-${year}-${section}`;
      this.settings.days.forEach(day => {
        for (let period = 0; period < this.settings.totalPeriods; period++) {
          const subject = this.timetableData[classKey][day][period];
          csvContent += `"${className}","${day}","Period ${period + 1}","${subject}"\n`;
        }
      });
    }
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `timetable_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showStatus("Timetable exported successfully!", "success");
  }

  clearAll() {
    this.timetableData = {};
    this.teacherSchedule = {};
    this.roomSchedule = {};
    this.csvData = null;
    const container = document.getElementById("timetableContainer");
    if (container) container.innerHTML = "";
    const statusMessage = document.getElementById("statusMessage");
    if (statusMessage) statusMessage.innerHTML = "";
    const csvUpload = document.getElementById("csvUpload");
    if (csvUpload) csvUpload.value = "";
    const generateBtn = document.getElementById("generateBtn");
    if (generateBtn) generateBtn.disabled = true;
    const exportBtn = document.getElementById("exportBtn");
    if (exportBtn) exportBtn.disabled = true;
    const label = document.querySelector('.file-upload-label');
    if (label) {
      label.textContent = "Upload Subject CSV";
    }
  }
}

// Instantiate the class after DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.generator = new TimetableGenerator();
});
