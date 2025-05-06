const fs = require('fs').promises;
const { format, parse, isAfter, isSameDay } = require('date-fns');

async function loadJsonData(filePath = 'processed_train_schedule.json') {
  try {
    console.log(`Reading JSON file: ${filePath}`);
    const data = await fs.readFile(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    console.log('JSON file read successfully');
    return jsonData;
  } catch (error) {
    console.error('Error reading JSON file:', error.stack);
    throw error;
  }
}

async function checkValidity() {
  try {
    const jsonData = await loadJsonData();
    const validity = jsonData.validity;
    if (!validity) {
      console.warn('No validity data found in JSON');
      return { isValid: false, isHoliday: false, isWeekend: false, dayType: 'invalid' };
    }
    const today = new Date();
    const start = new Date(validity.date_debut.split('-').reverse().join('-')); // Format jj-mm-aaaa -> aaaa-mm-jj
    const end = new Date(validity.date_fin.split('-').reverse().join('-'));    // Format jj-mm-aaaa -> aaaa-mm-jj
    console.log(`Checking validity: today=${today.toISOString()}, start=${start.toISOString()}, end=${end.toISOString()}`);

    const isValidPeriod = start <= today && today <= end;

    const isWeekend = today.getDay() === 0 || today.getDay() === 6; // 0 = Dimanche, 6 = Samedi
    console.log(`Is today a weekend? ${isWeekend}`);

    const holidays = jsonData.feries || [];
    const formattedToday = format(today, 'dd-MM-yyyy');
    console.log(`Checking holidays: ${formattedToday} against ${holidays}`);
    const isHoliday = holidays.includes(formattedToday);
    console.log(`Is ${formattedToday} a holiday? ${isHoliday}`);

    const dayType = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'ordinary';
    const isValid = isValidPeriod && dayType !== 'invalid';
    console.log(`Final validity check: period=${isValidPeriod}, dayType=${dayType}, result=${isValid}`);
    return { isValid, isHoliday, isWeekend, dayType };
  } catch (error) {
    console.error('Error checking validity:', error.stack);
    throw error;
  }
}

async function loadValidityDates() {
  try {
    const jsonData = await loadJsonData();
    const validity = jsonData.validity;
    if (!validity) {
      console.warn('No validity data found in JSON');
      return null;
    }
    console.log('Validity dates loaded:', validity);
    return validity;
  } catch (error) {
    console.error('Error loading validity dates:', error.stack);
    throw error;
  }
}

async function loadSchedules(line, direction) {
  try {
    const jsonData = await loadJsonData();
    const lineData = jsonData.lines[line];
    if (!lineData) {
      console.error(`Line ${line} not found in JSON data`);
      throw new Error(`Line ${line} not found`);
    }
    const schedules = lineData[direction];
    if (!schedules) {
      console.error(`Direction ${direction} for line ${line} not found in JSON data`);
      throw new Error(`Direction ${direction} for line ${line} not found`);
    }
    console.log(`Schedules from JSON (${line}/${direction}):`, schedules);

    const { isHoliday, isWeekend, dayType } = await checkValidity();
    const today = new Date(); // Définir today localement
    console.log(`Filtering schedules for ${line}/${direction} with today=${today.toISOString()}`);

    const filteredSchedules = schedules.filter(train => {
      if (!train || !train.schedule) return false; // Vérification de sécurité
      const type = train.type;
      switch (dayType) {
        case 'holiday':
          return type === 'DF' || type === 'Q'; // Seulement DF et Q circulent les jours fériés
        case 'weekend':
          return type === 'DF' || type === 'Q'; // Seulement DF et Q circulent les week-ends
        case 'ordinary':
          return type === 'Q' || // Quotidien
                 (type === 'SFDF' && !isHoliday) || // Sauf Dimanche et Férié
                 (type === 'LU-VE NF' && !isHoliday && [1, 2, 3, 4, 5].includes(today.getDay())); // Lundi à Vendredi Non Férié
        default:
          return false;
      }
    });

    const allStationsSet = new Set();
    filteredSchedules.forEach(train => {
      Object.keys(train.schedule).forEach(station => {
        allStationsSet.add(station);
      });
    });

    const firstTrainStations = Object.keys(filteredSchedules[0]?.schedule || {});
    const stationList = [...firstTrainStations];

    allStationsSet.forEach(station => {
      if (!stationList.includes(station)) {
        const trainWithStation = filteredSchedules.find(train => train.schedule[station]);
        const trainStations = Object.keys(trainWithStation?.schedule || {});
        const stationIndex = trainStations.indexOf(station);
        let insertIndex = stationList.length;

        let prevStation = null;
        let nextStation = null;
        if (stationIndex > 0) {
          prevStation = trainStations[stationIndex - 1];
        }
        if (stationIndex < trainStations.length - 1) {
          nextStation = trainStations[stationIndex + 1];
        }

        const prevStationIndex = prevStation ? stationList.indexOf(prevStation) : -1;
        const nextStationIndex = nextStation ? stationList.indexOf(nextStation) : -1;

        if (prevStationIndex !== -1 && nextStationIndex !== -1) {
          if (prevStationIndex < nextStationIndex) {
            insertIndex = prevStationIndex + 1;
          } else {
            insertIndex = nextStationIndex;
          }
        } else if (prevStationIndex !== -1) {
          insertIndex = prevStationIndex + 1;
        } else if (nextStationIndex !== -1) {
          insertIndex = nextStationIndex;
        }

        stationList.splice(insertIndex, 0, station);
      }
    });

    console.log(`Station list in order for ${line}/${direction}:`, stationList);

    const formattedSchedules = {};
    stationList.forEach(station => {
      const horaires = [];
      const numeros = [];
      const freqList = [];

      filteredSchedules.forEach(train => {
        if (train.schedule[station]) {
          horaires.push(train.schedule[station]);
          numeros.push(train.train_number);
          freqList.push(train.type);
        } else {
          horaires.push(null);
          numeros.push(train.train_number);
          freqList.push(train.type);
        }
      });

      formattedSchedules[station] = {
        horaires,
        numeros,
        frequences: freqList,
        line
      };
    });

    console.log(`Formatted schedules for ${line}/${direction} (filtered):`, formattedSchedules);
    return formattedSchedules;
  } catch (error) {
    console.error(`Error loading schedules for ${line}/${direction}:`, error.stack);
    throw error;
  }
}

async function loadAnnouncements() {
  try {
    const jsonData = await loadJsonData();
    const announcements = jsonData.announcements || [];
    if (!announcements.length) {
      console.warn('No announcements found in JSON');
    } else {
      console.log('Announcements loaded:', announcements);
    }
    return announcements;
  } catch (error) {
    console.error('Error loading announcements:', error.stack);
    throw error;
  }
}

async function loadStations() {
  try {
    const jsonData = await loadJsonData();
    const stations = jsonData.stations || {};
    console.log('Stations loaded:', stations);
    return stations;
  } catch (error) {
    console.error('Error loading stations:', error.stack);
    throw error;
  }
}

module.exports = { checkValidity, loadSchedules, loadAnnouncements, loadStations, loadValidityDates };