/* eslint-disable  func-names */
/* eslint quote-props: ["error", "consistent"]*/

'use strict';

const Alexa = require('alexa-sdk');
const https = require('https');
const util = require('util');

const APP_ID = process.env.APP_ID; // TODO replace with your app ID (OPTIONAL).

const QUANDL_API_KEY = process.env.QUANDL_API_KEY;
const QUANDL_HOST = 'www.quandl.com';
const QUANDL_PATH_TEMPLATE = '/api/v3/datasets/SSE/%s.json?limit=1&column_index=3&api_key=' + QUANDL_API_KEY;

const languageStrings = {
  'de': {
    translation: {
      SKILL_NAME: 'Börsenkurse',
      WELCOME_MESSAGE: 'Willkommen bei %s. Du kannst beispielsweise sagen: Welchen Aktienkurs hat die Daimler AG? ... Nun, womit kann ich dir helfen?',
      WELCOME_REPROMT: 'Wenn du wissen möchtest, was du sagen kannst, sag einfach „Hilf mir“.',
      DISPLAY_CARD_TITLE: '%s - Aktienkurs für %s.',
      STOCK_MESSAGE: 'Der Kurs der %s Aktie steht bei %s Euro.',
      STOCK_MESSAGE_REQUEST_FAIL: 'Ich konnte den Kurs für %s nicht abrufen.',
      HELP_MESSAGE: 'Du kannst beispielsweise Fragen stellen wie „Welchen Kurs hat die Hypoport AG“ oder du kannst „Beenden“ sagen ... Wie kann ich dir helfen?',
      HELP_REPROMT: 'Du kannst beispielsweise Sachen sagen wie „Sag mir den Aktienkurs der Volkswagen AG“ oder du kannst „Beenden“ sagen ... Wie kann ich dir helfen?',
      STOP_MESSAGE: 'Auf Wiedersehen!',
      RECIPE_REPEAT_MESSAGE: 'Sage einfach „Wiederholen“.',
      RECIPE_NOT_FOUND_MESSAGE: 'Tut mir leid, ich kenne derzeit ',
      RECIPE_NOT_FOUND_WITH_ITEM_NAME: 'die Aktie %s nicht. ',
      RECIPE_NOT_FOUND_WITHOUT_ITEM_NAME: 'diese Aktie nicht. ',
      RECIPE_NOT_FOUND_REPROMPT: 'Womit kann ich dir sonst helfen?',
    },
  },
};

const stocks = {
  'hypoport': 'HYQ',
  'hypoport ag': 'HYQ',
  'daimler': 'DAI',
  'daimler ag': 'DAI',
  'volkswagen': 'VOW3',
  'volkswagen ag': 'VOW3'
};

// https://davidwalsh.name/nodejs-http-request
// https://stackoverflow.com/questions/12851858/https-request-in-nodejs
// https://nodejs.org/dist/latest-v6.x/docs/api/http.html#http_http_get_options_callback
function get_stock_price(symbol, callback) {
  var url = util.format('https://%s%s', QUANDL_HOST, util.format(QUANDL_PATH_TEMPLATE, symbol));

  return https.get(url, function(response){

    const statusCode = response.statusCode;
    const contentType = response.headers['content-type'];

    let error;
    if (statusCode !== 200) {
      error = new Error(`Request Failed.\n` +
          `Status Code: ${statusCode}`);
    } else if (!/^application\/json/.test(contentType)) {
      error = new Error(`Invalid content-type.\n` +
          `Expected application/json but received ${contentType}`);
    }
    if (error) {
      console.error(error.message);
      // consume response data to free up memory
      response.resume();
      callback(null);
      return;
    }

    // Continuously update stream with data
    var body = '';
    response.on('data', function(d) {
      body += d;
    });
    response.on('end', function() {
      // Data reception is done, do whatever with it!
      var parsed = JSON.parse(body);
      var date = parsed.dataset.data[0][0];
      var price = parsed.dataset.data[0][1];
      callback({date: date, price: price});
    });
    response.on('error', function(e) {
      console.error(e);
      callback(null);
    });
  });
}

const handlers = {
  'LaunchRequest': function () {
    this.attributes.speechOutput = this.t('WELCOME_MESSAGE', this.t('SKILL_NAME'));
    // If the user either does not reply to the welcome message or says something that is not
    // understood, they will be prompted again with this text.
    this.attributes.repromptSpeech = this.t('WELCOME_REPROMT');
    this.emit(':ask', this.attributes.speechOutput, this.attributes.repromptSpeech);
  },
  'StocksIntent': function () {
    const stockSlot = this.event.request.intent.slots.Stock;
    let stockName;
    if (stockSlot && stockSlot.value) {
      stockName = stockSlot.value;
    }

    const cardTitle = this.t('DISPLAY_CARD_TITLE', this.t('SKILL_NAME'), stockName);
    const stock = stocks[stockName.toLowerCase()];

    if (stock) {
      var that = this;
      get_stock_price(stock, function(response){
        if (response) {
          that.attributes.speechOutput = that.t('STOCK_MESSAGE', stockName, Number((response.price).toFixed(2)));
        } else {
          that.attributes.speechOutput = that.t('STOCK_MESSAGE_REQUEST_FAIL', stockName);
        }
        that.attributes.repromptSpeech = that.t('RECIPE_REPEAT_MESSAGE');
        that.emit(':askWithCard', that.attributes.speechOutput, that.attributes.repromptSpeech, cardTitle, that.attributes.speechOutput);
      });
    } else {
      let speechOutput = this.t('RECIPE_NOT_FOUND_MESSAGE');
      const repromptSpeech = this.t('RECIPE_NOT_FOUND_REPROMPT');
      if (stockName) {
        speechOutput += this.t('RECIPE_NOT_FOUND_WITH_ITEM_NAME', stockName);
      } else {
        speechOutput += this.t('RECIPE_NOT_FOUND_WITHOUT_ITEM_NAME');
      }
      speechOutput += repromptSpeech;

      this.attributes.speechOutput = speechOutput;
      this.attributes.repromptSpeech = repromptSpeech;

      this.emit(':ask', speechOutput, repromptSpeech);
    }
  },
  'AMAZON.HelpIntent': function () {
    this.attributes.speechOutput = this.t('HELP_MESSAGE');
    this.attributes.repromptSpeech = this.t('HELP_REPROMT');
    this.emit(':ask', this.attributes.speechOutput, this.attributes.repromptSpeech);
  },
  'AMAZON.RepeatIntent': function () {
    this.emit(':ask', this.attributes.speechOutput, this.attributes.repromptSpeech);
  },
  'AMAZON.StopIntent': function () {
    this.emit('SessionEndedRequest');
  },
  'AMAZON.CancelIntent': function () {
    this.emit('SessionEndedRequest');
  },
  'SessionEndedRequest': function () {
    this.emit(':tell', this.t('STOP_MESSAGE'));
  },
  'Unhandled': function () {
    this.attributes.speechOutput = this.t('HELP_MESSAGE');
    this.attributes.repromptSpeech = this.t('HELP_REPROMPT');
    this.emit(':ask', this.attributes.speechOutput, this.attributes.repromptSpeech);
  },
};

exports.handler = function (event, context) {
  const alexa = Alexa.handler(event, context);
  alexa.APP_ID = APP_ID;
  // To enable string internationalization (i18n) features, set a resources object.
  alexa.resources = languageStrings;
  alexa.registerHandlers(handlers);
  alexa.execute();
};
