const express = require('express');
const passport = require('passport');
const Patient = require('../models/patient');
const Appointment = require('../models/appointment');
const Doctor = require('../models/doctor');
const {
  ConvertChosenTime,
  convert,
  isLoggedIn,
  isAuthorizedPatient,
} = require('./helper');

const router = express.Router({ mergeParams: true });

// GET ROUTES

router.get('/patientregistration', (req, res) => {
  const data = {};
  data.user = req.user;
  data.NODE_ENV = process.env.NODE_ENV;
  res.render('patientregistration', { data });
});

router.get('/patientlogin', (req, res) => {
  const data = {};
  data.user = req.user;
  data.NODE_ENV = process.env.NODE_ENV;
  res.render('patientlogin', { data });
});

router.get('/patienthome', isLoggedIn, (req, res) => {
  const futureappointment = [];
  const pastappointment = [];
  const data = {};
  data.NODE_ENV = process.env.NODE_ENV;
  const obj1 = {};

  const SortPatientPromise = new Promise((resolve, reject) => {
    // Find all appointments of the patient
    Appointment.find({ PatientId: req.user._id })
      .populate('PrescriptionId')
      .exec((err, appointments) => {
        if (err) {
          reject(err);
        } else {
          resolve(appointments);
        }
      });
  });
  SortPatientPromise.then((result) => {
    result.forEach((item) => {
      const obj = {};

      // date1: Appointment time
      const date1 = new Date(item.AppointmentDate);

      // date2: Current date
      const date2 = new Date();

      obj.PatientId = item.PatientId;
      obj.DoctorId = item.DoctorId;
      obj.PrescriptionId = item.PrescriptionId;
      obj.AppointmentDate = convert(item.AppointmentDate);
      obj.AppointmentTime = ConvertChosenTime(item.AppointmentDate);
      obj.Disease = item.Disease;
      obj.Status = item.Status;
      obj.SerialNumber = item.SerialNumber;
      if (item.PrescriptionId == null) {
        obj.Symptoms = null;
        obj.Tests = null;
        obj.Medicines = null;
        obj.Remarks = null;
        obj.DoctorSignature = null;
      } else {
        obj.Symptoms = item.PrescriptionId.Symptoms;
        obj.Tests = item.PrescriptionId.Tests;
        obj.Medicines = item.PrescriptionId.Medicines;
        obj.Remarks = item.PrescriptionId.Remarks;
        obj.DoctorSignature = item.PrescriptionId.DoctorSignature;
      }

      if (date1.getTime() > date2.getTime()) {
        futureappointment.push(obj);
      } else {
        pastappointment.push(obj);
      }
    });
  }).catch((error) => {
    console.log(`Error From promise 1 a) ${error}`);
  });

  Promise.all([SortPatientPromise])
    .then((result) => {
      data.futureappointment = futureappointment;
      data.pastappointment = pastappointment;
      data.user = req.user;
      console.log(result);
      res.render('patienthome', { data });
    })
    .catch((error) => {
      console.log(`Error From promise 1 c) ${error}`);
    });
});

router.get(
  '/patienthome/bookappointment/:patientid',
  isAuthorizedPatient,
  (req, res) => {
    const data = {};
    data.user = req.user;
    data.NODE_ENV = process.env.NODE_ENV;
    data.patientid = req.params.patientid;
    res.render('appointmentbooking1', { data });
  }
);

router.post(
  '/patienthome/bookappointment/:patientid',
  isAuthorizedPatient,
  (req, res) => {
    const data = {};
    data.user = req.user;
    data.NODE_ENV = process.env.NODE_ENV;
    const url = `/patienthome/bookappointment/${req.params.patientid}/${req.body.disease}`;
    res.redirect(url);
  }
);

router.get(
  '/patienthome/bookappointment/:patientid/:disease',
  isAuthorizedPatient,
  (req, res) => {
    const ShowDoctorPromise = new Promise((resolve, reject) => {
      Doctor.find({ specialization: req.params.disease }).exec((err, item) => {
        if (err) {
          console.log('Oh no Error occured in updating patient data');
          reject(err);
        } else {
          resolve(item);
        }
      });
    });
    ShowDoctorPromise.then((result) => {
      const data = {};
      data.user = req.user;
      data.NODE_ENV = process.env.NODE_ENV;
      data.patientid = req.params.patientid;
      data.patientdisease = req.params.disease;
      data.doctor = result;
      res.render('appointmentbooking2', { data });
    }).catch((error) => {
      console.log(`Error From promise 2 ${error}`);
    });
  }
);

router.get(
  '/patienthome/bookappointment/:patientid/:disease/:doctorid',
  isAuthorizedPatient,
  (req, res) => {
    const ShowCalendarPromise = new Promise((resolve, reject) => {
      Appointment.find({ DoctorId: req.params.doctorid }).exec((err, item) => {
        if (err) {
          reject(err);
        } else {
          resolve(item);
        }
      });
    });
    let appointmentdata;
    const modifiedappointmentdata = [];
    ShowCalendarPromise.then((result) => {
      result.forEach((data) => {
        const obj = {};

        // date1: Appointment time
        const date1 = new Date(data.AppointmentDate);

        // date2: Setting same appointment time to all appointments of same day
        const date2 = new Date(date1.getTime() - (date1.getTime() % 86400000));

        obj.AppointmentDate = date2;
        modifiedappointmentdata.push(obj);
      });
    })
      .then((result) => {
        console.log(result);
        appointmentdata = modifiedappointmentdata.reduce((acc, it) => {
          acc[it.AppointmentDate] = acc[it.AppointmentDate] + 1 || 1;
          return acc;
        }, {});
      })
      .then((result) => {
        console.log(result);
        const data = {};
        const jsondata = JSON.stringify(appointmentdata);
        data.sortedpatient = jsondata;
        const date1 = new Date(req.user.AppointmentDate);
        const date2 = new Date(date1.getTime() - (date1.getTime() % 86400000));
        const sno =
          (date1.getTime() - date2.getTime() - 4.5 * 60 * 60 * 1000) /
            (15 * 60 * 1000) +
          1;
        data.user = req.user;
        data.NODE_ENV = process.env.NODE_ENV;
        data.sno = sno;
        data.patientid = req.params.patientid;
        data.disease = req.params.disease;
        data.doctorid = req.params.doctorid;
        res.render('appointmentbooking3', { data });
      })
      .catch((error) => {
        console.log(`Error From promise 3 ${error}`);
      });
  }
);

router.post(
  '/patienthome/bookappointment/:patientid/:disease/:doctorid',
  isAuthorizedPatient,
  (req, res) => {
    const appointmentdate = new Date(req.body.ChosenDate);
    let time1 = appointmentdate.getTime() % (24 * 60 * 60 * 1000);
    time1 -= 4.5 * 60 * 60 * 1000;

    const PatientId = req.params.patientid;
    const DoctorId = req.params.doctorid;
    const AppointmentDate = req.body.ChosenDate;
    const Disease = req.params.disease;
    const Status = 'Yet to be confirmed';
    const SerialNumber = parseInt(time1 / (15 * 60 * 1000), 10);

    const obj = new Appointment({
      PatientId,
      DoctorId,
      AppointmentDate,
      Disease,
      Status,
      SerialNumber,
    });
    Appointment.create(obj, (err, item) => {
      if (err) {
        console.log(err);
      }
      console.log(item);
      res.redirect('/patienthome');
    });
  }
);

router.get('/patienthome/:patientid/edit', isAuthorizedPatient, (req, res) => {
  const ShowPatientPromise = new Promise((resolve, reject) => {
    Patient.findById(req.params.patientid).exec((err, item) => {
      if (err) {
        reject(err);
      } else {
        resolve(item);
      }
    });
  });
  ShowPatientPromise.then((result) => {
    const data = {};
    data.NODE_ENV = process.env.NODE_ENV;
    data.user = req.user;
    data.patient = result;
    res.render('patientedit', { data });
  }).catch((error) => {
    console.log(`Error From promise 4 ${error}`);
    res.redirect('back');
  });
});

// POST ROUTES

// Patient Login
router.post(
  '/patientlogin',
  passport.authenticate('patientlocal', {
    successRedirect: '/patienthome',
    failureRedirect: '/patientlogin',
  })
);

router.post('/patientregistration', (req, res) => {
  const newpatient = new Patient({
    username: req.body.username,
    usertype: 'patient',
    name: req.body.name,
    dob: req.body.dob,
    phone: req.body.phone,
    address: req.body.address,
  });

  Patient.register(newpatient, req.body.password, (err, item) => {
    if (err) {
      console.log(err);
      const data = {};
      data.user = req.user;
      data.NODE_ENV = process.env.NODE_ENV;
      res.render('patientregistration', { data });
    }
    console.log(item);
    passport.authenticate('patientlocal')(req, res, () => {
      res.redirect('/patienthome');
    });
  });
});

// UPDATE ROUTES

// Update Patient Credentials
router.put('/patienthome/:patientid/edit', isAuthorizedPatient, (req, res) => {
  Patient.findByIdAndUpdate(req.params.patientid, req.body, (err, item) => {
    if (err) {
      console.log(err);
      res.redirect('/patienthome');
    } else {
      console.log('Successfully Updated Patient ', item);
      res.redirect('/patienthome');
    }
  });
});

module.exports = router;
