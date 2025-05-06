const express = require('express');
  const cors = require('cors');
  const { checkValidity, loadSchedules, loadAnnouncements, loadStations, loadValidityDates } = require('./excelParser');

  const app = express();
  app.use(cors({
    origin: '*', // Autorise toutes les origines pour le test local
  }));
  app.use(express.json());

  app.get('/api/validity', async (req, res) => {
    try {
      const result = await checkValidity();
      res.json(result); // Retourne { isValid, isHoliday, isWeekend, dayType }
    } catch (error) {
      console.error('Error in /api/validity:', error.stack);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/validity-dates', async (req, res) => {
    try {
      console.log('Fetching validity dates...');
      const validity = await loadValidityDates();
      console.log('Validity dates fetched successfully:', validity);
      res.json(validity);
    } catch (error) {
      console.error('Error in /api/validity-dates:', error.stack);
      res.status(500).json({ error: 'Failed to fetch validity dates' });
    }
  });

  app.get('/api/schedules/:line/:direction', async (req, res) => {
    const { line, direction } = req.params;
    try {
      console.log(`Fetching schedules for line ${line}, direction ${direction}`);
      const schedules = await loadSchedules(line, direction);
      console.log('Schedules fetched successfully:', schedules);
      res.json(schedules);
    } catch (error) {
      console.error(`Error in /api/schedules/${line}/${direction}:`, error.stack);
      res.status(500).json({ error: 'Failed to load schedules', details: error.message });
    }
  });

  app.get('/api/announcements', async (req, res) => {
    try {
      console.log('Fetching announcements...');
      const announcements = await loadAnnouncements();
      console.log('Announcements fetched successfully:', announcements);
      res.json(announcements);
    } catch (error) {
      console.error('Error in /api/announcements:', error.stack);
      res.status(500).json({ error: 'Failed to fetch announcements' });
    }
  });

  app.get('/api/stations', async (req, res) => {
    try {
      console.log('Fetching stations...');
      const stations = await loadStations();
      console.log('Stations fetched successfully:', stations);
      res.json(stations);
    } catch (error) {
      console.error('Error in /api/stations:', error.stack);
      res.status(500).json({ error: 'Failed to fetch stations' });
    }
  });

  const port = process.env.PORT || 3001;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
  });