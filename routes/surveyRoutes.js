const _ = require('lodash');
const Path = require('path-parser').default
const { URL } = require('url');
const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');
const requireCredits = require('../middlewares/requireCredits');
const Mailer = require('../services/Mailer');
const surveyTemplate = require('../services/emailTemplates/surveyTemplate');

const Survey = mongoose.model('surveys');

module.exports = app => {

  app.get("/api/surveys/thanks", (req, res) => {
    res.send('Thanks for voting!');
  })

  app.post('/api/surveys/webhooks', (req, res) => {
    const events = _.map(req.body, ({email, url}) => {
      const pathname = new URL(url).pathname;
      const p = Path.createPath('/api/surveys/:surveyId/:choice')
      const match = p.test(pathname);
      if (match) {
        const { surveyId, choice } = match;
        return { email, surveyId, choice};
      }
    }) 
    // remove elements of undefine
    const compactEvents = _.compact(events); 
    const uniqueEvents =_.uniqBy(compactEvents, 'email', 'surveyId');
    console.log(uniqueEvents);
    res.send({})
  })

  app.post('/api/surveys', requireLogin, requireCredits, async (req, res) => {
    const { title, subject, body, recipients } = req.body;
    const survey = new Survey({ 
      title, 
      subject, 
      body,
      recipients: recipients.split(',').map( email => ({ email: email.trim() })),
      _user: req.user.id,
      dateSent: Date.now()
    });

    // Great place to send an email
    const mailer = new Mailer(survey, surveyTemplate(survey));
    try {
      await mailer.send();
      await survey.save();
      //handle user credits
      req.user.credits -= 1;
      const user = await req.user.save();
      res.send(user)
    } catch (error) {
      res.status(422).send(err);
    }
  })


};

