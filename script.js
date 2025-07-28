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
        // Expecting: Department,Year,Section,Subject,Periods,Staff
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
        // Check for the 6 columns we expect
        const requiredColumns = ['Department', 'Year', 'Section', 'Subject', 'Periods', 'Staff'];
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
      if (!row.Staff?.toString().trim()) errors.push(`Row ${rowNum}: Staff is required`);
      const periods = parseInt(row.Periods);
      if (isNaN(periods) || periods <= 0) {
        errors.push(`Row ${rowNum}: Periods must be a positive number`);
      } else if (periods > this.settings.totalPeriods * this.settings.days.length) {
        warnings.push(`Row ${rowNum}: ${periods} periods/week may be too many to schedule`);
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
      // Infer type: If subject contains 'lab' (case-insensitive), treat as lab, else theory
      const isLab = /lab/i.test(row.Subject);
      const teacherList = isLab
        ? row.Staff.split(',').map(t => t.trim()).filter(Boolean)
        : [row.Staff.toString().trim()];
      const labRoom = isLab ? (row.LabRoom ? row.LabRoom.toString().trim() : "Lab1") : null;
      periodsPerWeekMap[classKey].push({
        subject: row.Subject.toString().trim(),
        teachers: teacherList,
        periods: parseInt(row.Periods),
        isLab: isLab,
        labRoom: labRoom,
        priority: isLab ? 1 : 2
      });
      teacherList.forEach(tname => {
        if (!teacherWorkload[tname]) teacherWorkload[tname] = 0;
        teacherWorkload[tname] += parseInt(row.Periods);
      });
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

  isSlotAvailable(classKey, day, period, teachers, isLab = false, labRoom = null) {
    if (this.timetableData[classKey][day][period] !== "FREE") return false;
    if (isLab) {
      if (period >= this.settings.totalPeriods - 1) return false;
      if (this.timetableData[classKey][day][period + 1] !== "FREE") return false;
      if (this.settings.breakPeriods.includes(period + 2) ||
          this.settings.lunchPeriod === period + 2) return false;
      // Check all 3 teachers for both periods
      const teachersFree = teachers.every(teacher => {
        const teacherSlots = this.teacherSchedule[teacher] || [];
        return !teacherSlots.includes(`${day}_${period}`) && !teacherSlots.includes(`${day}_${period + 1}`);
      });
      // Check lab room availability for both periods
      if (labRoom) {
        const roomSlots = this.roomSchedule[labRoom] || [];
        if (roomSlots.includes(`${day}_${period}`) || roomSlots.includes(`${day}_${period + 1}`)) return false;
      }
      return teachersFree;
    } else {
      const teacher = teachers[0];
      const slot = `${day}_${period}`;
      const teacherSlots = this.teacherSchedule[teacher] || [];
      return !teacherSlots.includes(slot);
    }
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
        const dayIndex = this.getWeightedRandomDay(classKey, subjectData.teachers[0]);
        const day = this.settings.days[dayIndex];
        const period = this.getRandomAvailablePeriod(classKey, day, subjectData.isLab);
        if (period === -1 || !this.isSlotAvailable(
              classKey, day, period, subjectData.teachers, subjectData.isLab, subjectData.labRoom)) {
          continue;
        }
        if (subjectData.isLab) {
          const labLabel = `${subjectData.subject} LAB (${subjectData.teachers.join(", ")})`;
          this.timetableData[classKey][day][period] = labLabel;
          this.timetableData[classKey][day][period + 1] = labLabel;
          // Mark all teachers
          subjectData.teachers.forEach(t => {
            if (!this.teacherSchedule[t]) this.teacherSchedule[t] = [];
            this.teacherSchedule[t].push(`${day}_${period}`, `${day}_${period + 1}`);
          });
          // Mark lab room
          if (subjectData.labRoom) {
            if (!this.roomSchedule[subjectData.labRoom]) this.roomSchedule[subjectData.labRoom] = [];
            this.roomSchedule[subjectData.labRoom].push(`${day}_${period}`, `${day}_${period + 1}`);
          }
          allocated += 2;
        } else {
          const teacher = subjectData.teachers[0];
          this.timetableData[classKey][day][period] = `${subjectData.subject} (${teacher})`;
          if (!this.teacherSchedule[teacher]) this.teacherSchedule[teacher] = [];
          this.teacherSchedule[teacher].push(`${day}_${period}`);
          allocated += 1;
        }
      }
      totalAllocated += allocated;
      if (allocated < subjectData.periods) {
        const shortage = subjectData.periods - allocated;
        warnings.push(
          `⚠️ ${classKey}: Could not allocate ${shortage} period(s) for ${subjectData.subject} (${subjectData.teachers.join(", ")})`
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
    // ... (same as previous code, omitted for brevity)
    // Use your existing renderTimetables implementation here.
  }

  renderStats(container) {
    // ... (same as previous code, omitted for brevity)
    // Use your existing renderStats implementation here.
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

window.addEventListener('DOMContentLoaded', () => {
  window.generator = new TimetableGenerator();
});
