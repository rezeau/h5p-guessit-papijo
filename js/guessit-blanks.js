H5P.GuessIt = (function ($, Question) {
  /**
   * @constant
   * @default
   */
  const STATE_ONGOING = 'ongoing';
  const STATE_CHECKING = 'checking';
  const STATE_SHOWING_SOLUTION = 'showing-solution';
  const STATE_FINISHED = 'finished';

  const XAPI_REPORTING_VERSION_EXTENSION = 'https://h5p.org/x-api/h5p-reporting-version';
  /**
   * @typedef {Object} Params
   *  Parameters/configuration object for GuessIt
   *
   * @property {Object} Params.behaviour
   * @property {string} Params.behaviour.confirmResetDialog
   *
   * @property {Object} Params.confirmRetry
   * @property {string} Params.confirmRetry.header
   * @property {string} Params.confirmRetry.body
   * @property {string} Params.confirmRetry.cancelLabel
   * @property {string} Params.confirmRetry.confirmLabel
   *
   * @property {Object} Params.confirmCheck
   * @property {string} Params.confirmCheck.header
   * @property {string} Params.confirmCheck.body
   * @property {string} Params.confirmCheck.cancelLabel
   * @property {string} Params.confirmCheck.confirmLabel
   */

  /**
   * Initialize module.
   *
   * @class H5P.GuessIt
   * @extends H5P.Question
   * @param {Params} params
   * @param {number} id Content identification
   * @param {Object} contentData Task specific content data
   */
  function GuessIt(params, id, contentData) {
    let self = this;
    // Inheritance. User for CSS!
    Question.call(self, 'guessit');

    // IDs
    this.contentId = id;
    this.contentData = contentData;

    this.params = $.extend(true, {}, {
      description: "Task description",
      questions: [
        {
          "sentence": "Papi Jo is the best!"
        }
      ],
      playMode: 'availableSentences',
      showSolutions: "Show solution",
      tryAgain: "Try again",
      newSentence: 'Guess another sentence',
      endGame: 'End Game',
      checkAnswer: "Check",
      notFilledOut: "Please fill in all the blanks before checking your answer!",
      notEnoughRounds: "This option won't be available before Round @round",
      answerIsCorrect: "':ans' is correct",
      answerIsWrong: "':ans' is wrong",
      answeredCorrectly: "Answered correctly",
      answeredIncorrectly: "Answered incorrectly",
      solutionLabel: "Correct answer:",
      inputLabel: "Blank input @num of @total",
      inputHasTipLabel: "Tip available",
      round: "Round @round",
      sentence: 'sentence',
      sentences: 'sentences',
      timeSpent: "Time Spent",
      tipLabel: "Tip",
      audioNotSupported: 'Your browser does not support this audio',
      scoreBarLabel: 'You got :num out of :total points',
      numWords: 'How many words do you want in your mystery sentence?',
      anyNumber: 'Any number',
      summary: 'Summary',
      sentencesGuessed: 'Sentences guessed',
      solutionsViewed: 'Solutions viewed',
      totalTimeSpent: 'Total Time Spent',
      totalRounds: 'Total Rounds',
      scoreExplanationButtonLabel: 'Show score explanation',
      scoreExplanationforAllSentences: 'Score = number of guessed sentences / number of sentences in this activity.',
      scoreExplanationforSentencesWithNumberWords: 'Score = number of guessed sentences / number of sentences containing @words words.',
      userSentenceDescriptionLabel: 'Type a sentence, phrase or word to be guessed by your friends. Words can be split with forward slashes, e.g. electr/o/cardi/o/gram',
      userWordDescriptionLabel: 'Type a 5-letter word to be guessed by your friends. No capital letters.',
      userSentencenumRoundsLabel: 'Minimum number of rounds before Solutions can be displayed:',
      userWordnumRoundsLabel: 'Maximum number of tries before Game is over and Solution is displayed:',
      userSentenceTipLabel: 'Type a Tip for this sentence (optional)',
      userSentenceNeverShow: 'Never Show',
      newWord: 'Guess another word',
      userWordNoLimit: 'No limit',
      wordFound: 'Word found: ',
      wordNotFound: 'Word not found: ',
      wordsFound: 'Words found: ',
      scoreExplanationforAllWords: 'Score = number of words found / number of words tried.',
      behaviour: {
        enableRetry: false,
        enableAudio: false,
        enableNumChoice: false,
        enableSolutionsButton: false,
        enableEndGameButton: false,
        listGuessedSentences: false,
        listGuessedTips: false,
        numRounds: 1,
        maxTries: 6,
        caseSensitive: false,
        sentencesOrder: 'normal',
        listGuessedAudioAndTips: 'none',
        displayAudio: 'correct'
      }
    }, params);

    // Delete empty questions. Should normally not happen, but...
    // This check is needed if this GuessIt activity instance was saved with an empty item/sentence.

    if (this.params.wordle) {
      // "Convert" following 2 parals from Wordle option to Sentences.
      this.params.playMode = this.params.playModeW;
      this.params.questions = this.params.questionsW;
      // Always show list of found or not found words.
      this.params.behaviour.listGuessedSentences = true;
      // Always display the words in random order.
      this.params.behaviour.sentencesOrder = 'random';

    }
    if (this.params.playMode === 'availableSentences') {
      for (let i = this.params.questions.length - 1; i >= 0; i--) {
        if (!this.params.questions[i].sentence) {
          this.params.questions.length --;
        }
      }
    }
    this.originalQuestions = this.params.questions;
    // JR added an ID field (needed for save state + numberchoice).
    for (let i = 0; i < this.params.questions.length; i++) {
      this.params.questions[i]["ID"] = i;
    }
    this.totalNumQuestions = this.params.questions.length;
    if (this.params.playMode === 'userSentence') {
      this.totalNumQuestions = 1;
      this.params.behaviour.enableSolutionsButton = false;
      this.params.behaviour.enableEndGameButton = false;
    }
    if (this.params.wordle) {
      this.params.behaviour.enableSolutionsButton = false;
    }
    this.sentencesList = '';
    // Previous state
    this.contentData = contentData;
    if (this.contentData !== undefined && this.contentData.previousState !== undefined) {
      this.previousState = this.contentData.previousState;
    }

    // Clozes
    this.clozes = [];
    this.numQuestionsInWords = [];
    this.sentencesFound = 0;
    this.sentencesGuessed = [];
    this.nbSentencesGuessed = 0;
    this.wordsNotFound = [];
    // Init userAnswers
    this.userAnswers = [];

    this.currentAnswer = '';
    this.totalTimeSpent = 0;
    this.totalRounds = 0;
    this.solutionsViewed = [];
    this.nbSsolutionsViewed = 0;
    // Used by enableNumChoice
    this.numWords = 0;
    this.numQuestions = 0;
    // used by XAPI
    this.success = false;
    this.totalTime = '';
    if (this.params.behaviour.enableSolutionsButton) {
      this.params.behaviour.enableEndGameButton = false;
    }
    // Init currentSentence values
    this.sentenceClozeNumber = [];

    // Keep track tabbing forward or backwards
    this.shiftPressed = false;

    this.confirmEndGameEnabled = true;

    H5P.$body.keydown(function (event) {
      if (event.keyCode === 16) {
        self.shiftPressed = true;
      }
    }).keyup(function (event) {
      if (event.keyCode === 16) {
        self.shiftPressed = false;
      }
    });
  }

  // Inheritance
  GuessIt.prototype = Object.create(Question.prototype);
  GuessIt.prototype.constructor = GuessIt;

  /**
   * Registers this question type's DOM elements before they are attached.
   * Called from H5P.Question.
   */
  GuessIt.prototype.registerDomElements = function (sentence) {
    let self = this;
    this.$taskdescription = $('<div>', {
      'class': 'h5p-guessit h5p-guessit-description',
      'html': this.params.description
    });
    let $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    $content.addClass ('h5p-guessit h5p-frame');

    // We must remove current $taskdescription if student did not fill in the input form correctly.
    if (this.params.playMode === 'userSentence') {
      $content.find('.h5p-guessit-description').remove();
    }

    this.$taskdescription.prependTo($content);

    // Special case of userSentence mode.
    if (this.params.playMode === 'userSentence') {
      // Case guess a sentence.
      if (!self.params.wordle) {
        let label = self.params.userSentenceDescriptionLabel;
        this.$userSentenceDescription = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-usersentencedescription h5p-guessit-required',
          'html': label
        });
        if (this.warning) {
          this.$userSentenceDescription
            .removeClass('h5p-guessit-required')
            .addClass('h5p-guessit-warning');
        }

        this.$userTipDescription = $('<div>', {
          'class': 'h5p-guessit-usertipdescription',
          'html': self.params.userSentenceTipLabel
        });

        self.params.behaviour.enableNumChoice = false;
        let usersentence = document.createElement('input');
        usersentence.setAttribute("type", "text");
        usersentence.setAttribute("id", "usersentence");
        usersentence.setAttribute("class", "h5p-text-input-user");
        usersentence.setAttribute("autocomplete", "off");
        usersentence.setAttribute("autocapitalize", "off");

        let usertip = document.createElement('input');
        usertip.setAttribute("type", "text");
        usertip.setAttribute("id", "usertip");
        usertip.setAttribute("class", "h5p-text-input-user");

        this.$userSentenceDescription.appendTo(this.$taskdescription);
        this.$userSentence = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-options h5p-userSentence',
          'html': usersentence
        });
        this.$userSentence.appendTo(this.$userSentenceDescription);
        usersentence.focus();

        this.$userTipDescription.appendTo(this.$userSentence);
        this.$userTip = $('<div>', {
          'class': 'h5p-userTip',
          'html': usertip
        });
        this.$userTip.appendTo(this.$userTipDescription);

        // Validate user sentence & possibly other options...
        const $optionButtons = $('<div>', {
          'class': 'h5p-guessit-optionsbuttons',
          'html': '<div>' + this.params.userSentencenumRoundsLabel + '</div>'
        }).appendTo(this.$userTip);

        let radios = ['2', '5', '10', '15', '20', this.params.userSentenceNeverShow];
        let i = 0;
        for (let value of radios) {
          let user = 'userId-' + i;
          $optionButtons
            .append(`<input type="radio" id = "${user}" name="rounds" value="${value}">`)
            .append(`<label for="${value}">${value}</label></div>`);
          i++;
        }
        $optionButtons.append('<br>');
        // Set the 'Never show' 'userId-5' radio button checked.
        $("input[id = 'userId-5']").prop('checked', true);

        let $tip;
        H5P.JoubelUI.createButton({
          'class': 'h5p-guessit-okbutton',
          'title': 'OK',
          'html': 'OK'
        }).click(function () {
          let $usersentence = ($("#usersentence").val());

          $tip = ($("#usertip").val());
          if ($usersentence !== '') {
            let numRnds = $("input[name='rounds']:checked").val();
            if ( !$("input[id = 'userId-5']").is(':checked') ) {
              self.params.behaviour.enableSolutionsButton = true;
              self.params.behaviour.numRounds = numRnds;
            }
            else {
              self.params.behaviour.enableSolutionsButton = false;
            }
            self.warning = false;
            self.registerDomElements($usersentence);
          }
          else { // User sentence is empty OR wordle word not accepted.
            // Empty potential value of usertip.
            $("#usertip").val(null);
            // Empty user sentence and reset focus on input field
            $("#usersentence").val(null);
            $("#usersentence").focus();
            // Used to display a warning icon if sentence is empty or not OK.
            self.warning = true;
            // Return to registerDomElements with null sentence.
            self.registerDomElements();
          }
        }).appendTo($optionButtons);

        if (sentence === undefined) {
          return;
        }
        $content.find('.h5p-guessit-usersentencedescription').remove();
        self.params.questions[0].sentence = sentence;
        self.params.questions[0].tip = $tip;
        self.params.questions.length = 1;
      }
      else {
        // Case guess a word.
        let label = self.params.userWordDescriptionLabel;
        this.$userSentenceDescription = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-usersentencedescription h5p-guessit-required',
          'html': label
        });
        if (this.warning) {
          this.$userSentenceDescription
            .removeClass('h5p-guessit-required')
            .addClass('h5p-guessit-warning');
        }
        let usersentence = document.createElement('input');
        usersentence.setAttribute("type", "text");
        usersentence.setAttribute("id", "usersentence");
        usersentence.setAttribute("class", "h5p-word-input-user");
        usersentence.setAttribute("autocomplete", "off");
        usersentence.setAttribute("autocapitalize", "off");

        this.$userSentenceDescription.appendTo(this.$taskdescription);
        this.$userSentence = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-options h5p-userSentence',
          'html': usersentence
        });
        this.$userSentence.appendTo(this.$userSentenceDescription);
        usersentence.focus();

        // Validate user sentence & possibly other options...
        const $optionButtons = $('<div>', {
          'class': 'h5p-guessit-optionsbuttons',
          'html': '<div>' + this.params.userWordnumRoundsLabel + '</div>'
        }).appendTo(this.$userSentence);

        let radios = ['6', '8', '10', '12', this.params.userWordNoLimit];
        let i = 0;
        for (let value of radios) {
          let user = 'userId-' + i;
          $optionButtons
            .append(`<input type="radio" id = "${user}" name="rounds" value="${value}">`)
            .append(`<label for="${value}">${value}</label></div>`);
          i++;
        }
        $optionButtons.append('<br>');
        // Set the 'No limit' 'userId-5' radio button checked.
        $("input[id = 'userId-0']").prop('checked', true);

        H5P.JoubelUI.createButton({
          'class': 'h5p-guessit-okbutton',
          'title': 'OK',
          'html': 'OK'
        }).click(function () {
          let $usersentence = ($("#usersentence").val());
          let acceptedWord = true;
          let text = $usersentence;
          let pattern1 = /^\p{Ll}{5}$/u;
          acceptedWord = pattern1.test(text);
          if ($usersentence !== '' && acceptedWord) {
            let numRnds = $("input[name='rounds']:checked").val();
            if ( !$("input[id = 'userId-5']").is(':checked') ) {
              self.params.behaviour.maxTries = numRnds;
            }
            else {
              self.params.behaviour.maxTries = 99;
            }
            self.warning = false;
            self.registerDomElements($usersentence);
          }
          else { // User sentence is empty OR wordle word not accepted.
            // Empty user sentence and reset focus on input field
            $("#usersentence").val(null);
            $("#usersentence").focus();
            // Used to display a warning icon if sentence is empty or not OK.
            self.warning = true;
            // Return to registerDomElements with null sentence.
            self.registerDomElements();
          }
        }).appendTo($optionButtons);

        if (sentence === undefined) {
          return;
        }
        $content.find('.h5p-guessit-usersentencedescription').remove();
        self.params.questions[0].sentence = sentence;
        self.params.questions.length = 1;
      }
    }

    $content = $('[data-content-id="' + self.contentId + '"].h5p-content');

    self.numQuestions = self.params.questions.length;

    // Using instructions as label for our text groups
    let labelId = 'guessitlabel';

    // Register task content area
    self.setContent(self.createQuestions(labelId), {
    });

    // Init buttons for selecting number of words (if enabled in params.behaviour).
    if (this.params.behaviour.enableNumChoice) {

      // Put in array the number of words of all the questions
      let numWords = [];
      for (let i = 0; i < this.params.questions.length; i++) {
        numWords[i] = this.sentenceClozeNumber[i];
      }
      // https://stackoverflow.com/questions/5667888/counting-the-occurrences-frequency-of-array-elements
      let a = numWords;
      let result = { };
      for (let i = 0; i < a.length; ++i) {
        if (!result[a[i]])
          result[a[i]] = 0;
        ++result[a[i]];
      }

      let nbDifferentNums = Object.keys(result).length;
      // Do not ask user for nb words in sentences if there is no choice!
      if (nbDifferentNums > 1) {
        this.numQuestionsInWords = result;
        this.$numberWords = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-options',
          'html': this.params.numWords
        });

        let $optionButtons = $('<div>', {
          'class': 'h5p-guessit-optionsbuttons'
        }).appendTo(this.$numberWords);
        this.$numberWords.appendTo(this.$taskdescription);

        if (nbDifferentNums > 1) {
        // Remove duplicates from numWords array
          let uniquenumWords = [...new Set(numWords)];
          // Sort uniquenumWords array
          uniquenumWords.sort();
          // Get last item from uniquenumWords array
          uniquenumWords.slice(-1).pop();
          // Init iteratation
          let numSentencesWithWords = [];

          uniquenumWords.forEach(iterateNW);
          // Iterate uniquenumWords array
          function iterateNW(item) {
            let n = self.numQuestionsInWords[item];
            numSentencesWithWords[item] = n;
            let s = self.params.sentence;
            if (n > 1) {
              s = self.params.sentences;
            }
            H5P.JoubelUI.createButton({
              'class': 'h5p-guessit-number-button',
              'title': item,
              'html': item + ' [' + n + ' ' + s + ']',
              'id': 'dc-number-' + item
            }).click(function () {
              self.$numberWords.addClass ('h5p-guessit-hide');
              self.numWords = item;
              self.numQuestions = numSentencesWithWords[item];
              self.initTask();
            }).appendTo($optionButtons);
          }
          let n = self.params.questions.length;
          let s = self.params.sentences;
          let item = self.params.anyNumber;
          H5P.JoubelUI.createButton({
            'class': 'h5p-guessit-number-button',
            'title': item,
            'html': item +  ' [' + n + ' ' + s + ']',
            'id': 'dc-number-0'
          }).click(function () {
            self.$numberWords.addClass ('h5p-guessit-hide');
            self.params.behaviour.enableNumChoice = false;
            self.numQuestions = n;
            self.initTask();
          }).appendTo($optionButtons);

          // Hide content
          $content.find('.h5p-container').addClass('h5p-guessit h5p-guessit-hide');
        }
      }
      else {
        this.params.behaviour.enableNumChoice = false;
        self.numQuestions = self.params.questions.length;
        self.initTask();
      }
    }
    else {
      self.numQuestions = self.params.questions.length;
      self.initTask();
    }

    if (self.params.behaviour.listGuessedSentences) {
      let aClass;
      if (!self.params.wordle) {
        aClass = 'h5p-guessit-listGuessedSentences';
      }
      else {
        aClass = 'h5p-guessit-listGuessedWord';
      }

      this.$divGuessedSentences = $('<div>', {
        'class': aClass + ' h5p-guessit-hide'
      }).appendTo(this.$taskdescription);
      // Retrieve potentially previously saved list.
      self.setH5PUserState();
      if (self.sentencesGuessed !== '') {
        let guessedSentences = '';
        let questions = this.originalQuestions;
        let i;
        self.sentencesGuessed.forEach(function (item) {
          let foundSentence = questions[item].sentence;
          if (self.params.wordle) {
            i = self.wordsNotFound.indexOf(item);
            let bClass;
            let wordGuessed = true;
            if (i !== -1) {
              wordGuessed = false;
            }
            if (self.params.wordle) {
              if (wordGuessed) {
                bClass = 'h5p-guessit h5p-wordFound';
                foundSentence = '<span class="' + bClass + '">' + self.params.wordFound + foundSentence + '</span>';
              }
              else {
                bClass = 'h5p-guessit h5p-wordNotFound';
                foundSentence = '<span class="' + bClass + '">' + self.params.wordNotFound + foundSentence + '</span>';
              }
            }
          }
          guessedSentences += (!guessedSentences ? '' : '<br>') + foundSentence;
        });
        self.$divGuessedSentences.removeClass ('h5p-guessit-hide');
        self.$divGuessedSentences.html(guessedSentences);
      }
    }

    // ... and buttons
    self.registerButtons();

    if (this.params.playMode === 'userSentence') {
      $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
      $content.find('.h5p-userSentence').addClass('h5p-guessit h5p-guessit-hide');
      let $container = $content.children('.h5p-container');
      $('<div>', {
        'class': 'h5p-question-content',
        'html': this.$questions
      }).prependTo($container);
    }

    // Sets focus on first input when starting game.
    $(document).ready(function () {
      self.$questions.eq(self.currentSentenceId).filter(':first').find('input:enabled:first').focus();
    });

  };

  /**
   * Create all the buttons for the task
   */
  GuessIt.prototype.registerButtons = function () {
    let self = this;
    let $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    let $containerParents = $content.parents('.h5p-container');

    // select find container to attach dialogs to
    let $container;
    if ($containerParents.length !== 0) {
      // use parent highest up if any
      $container = $containerParents.last();
    }
    else if ($content.length !== 0) {
      $container = $content;
    }
    else  {
      $container = $(document.body);
    }

    // Check answer button
    self.addButton('check-answer', self.params.checkAnswer, function () {
      if (self.$timer === undefined) {
        self.initCounters();
      }
      self.setFeedback();
      if (!self.allBlanksFilledOut()) {
        self.updateFeedbackContent(self.params.notFilledOut);
        // Sets focus on first empty blank input.
        let $currentInputs = self.$questions.eq(self.currentSentenceId).find('input');
        $currentInputs.each(function () {
          if ($(this).val() === '') {
            $(this).focus();
            return false; // breaks
          }
        });

      }
      else {
        self.currentAnswer = '';
        let $currentInputs = self.$questions.eq(self.currentSentenceId).find('input');
        $currentInputs.each(function () {
          if ($(this).val() !== '') {
            self.currentAnswer += $(this).val() + ' ';
          }
        });
        self.toggleButtonVisibility(STATE_CHECKING);
        self.updateFeedbackContent('');
        self.markResults();
        self.timer.stop();

        let isFinished = (self.getScore() === self.getMaxScore());
        let wordGuessed = isFinished;
        if (self.params.wordle && self.maxTriesReached()) {
          isFinished = true;
        }
        if (isFinished) {
          if (!wordGuessed) {
            self.hideButton('check-answer');
            self.hideButton('try-again');
            self.nbSentencesGuessed--;
          }
          let currentGuessedSentenceId = self.params.questions[self.currentSentenceId].ID;
          self.sentencesGuessed.push(currentGuessedSentenceId);
          self.nbSentencesGuessed++;
          if (self.params.wordle && !wordGuessed) {
            self.wordsNotFound.push(currentGuessedSentenceId);
          }
          self.$questions.eq(self.currentSentenceId)
            .find('.h5p-guessit-audio-wrapper')
            .removeClass('hidden');

          self.getCurrentState();
          if (self.sentencesFound !== self.numQuestions - 1) {
            self.showButton('new-sentence');
            setTimeout(function () {
              self.focusButton();
            }, 20);
            self.showButton('end-game');
          }
          else {
            // button end-game2 does not ask for confirmation
            setTimeout(function () {
              self.focusButton();
            }, 20);
            self.showButton('end-game2');
          }

          if (self.params.behaviour.listGuessedSentences) {
            let currentSentence = self.params.questions[self.currentSentenceId];
            let foundSentence = currentSentence.sentence;
            // Remove potential slashes before displaying final phrase
            if (foundSentence.indexOf("/") !== -1) {
              let patternReplace = /\//g;
              foundSentence += ' <i class="fa fa-arrow-right" style="color:#4D9782;" ></i> ' + foundSentence.replace(patternReplace, '');
            }
            let bClass;
            if (self.params.wordle) {
              if (wordGuessed) {
                foundSentence = self.params.wordFound + foundSentence;
                bClass = 'h5p-guessit h5p-wordFound';
              }
              else {
                foundSentence = self.params.wordNotFound + foundSentence;
                bClass = 'h5p-guessit h5p-wordNotFound';
              }
            }
            self.$divGuessedSentences.removeClass ('h5p-guessit-hide');

            let $guessedSentence = $('<div>', {
              'class': bClass,
              'html': foundSentence
            })
              .appendTo(self.$divGuessedSentences);

            if (self.params.playMode === 'availableSentences') {
              let showTipsAndAudio = self.params.behaviour.listGuessedAudioAndTips;
              // Add tip button before guessed sentence
              let tip = currentSentence.tip;
              if (showTipsAndAudio === 'audioAndTip' || showTipsAndAudio === 'tipOnly' && tip !== undefined) {
                self.addTip(tip, $guessedSentence);
              }

              // Add audio button before guessed sentence
              let sound = currentSentence.audio;
              if (showTipsAndAudio === 'audioAndTip' || showTipsAndAudio === 'audioOnly'  && sound !== undefined) {
                self.addAudio(sound, $guessedSentence, false);
              }
            }
          }
        }
      }
    });

    // Try again button
    self.addButton('try-again', self.params.tryAgain, function () {
      self.updateFeedbackContent('');
      self.reTry();
      self.$questions.eq(self.currentSentenceId).filter(':first').find('input:enabled:first').focus();
    });

    // Show solution button
    self.addButton('show-solution', self.params.showSolutions, function () {
      self.showCorrectAnswers(false);
    }, self.params.behaviour.enableSolutionsButton);

    // New Sentence button
    let txtNewElement = self.params.newSentence;
    if (self.params.wordle) {
      txtNewElement = self.params.newWord;
    }
    self.addButton('new-sentence', txtNewElement, function () {
      self.newSentence();
      self.$questions.eq(self.currentSentenceId).filter(':first').find('input:enabled:first').focus();
    }, true);
    this.hideButton('new-sentence');
    this.hideButton('end-game');

    // End game button
    /* todo
    let isValidState = (this.previousState !== undefined
      && Object.keys(this.previousState).length !== 0);
*/
    self.addButton('end-game', self.params.endGame, function () {
      if (!self.allowSolution(self.params.endGame)) {
        return;
      }
      self.showFinalPage();
    }, true, {}, {
      confirmationDialog: {
        enable: self.confirmEndGameEnabled,
        l10n: self.params.confirmEndGame,
        instance: self,
        $parentElement: $container
      }
    });

    // End game button NO CONFIRMATION NEEDED
    self.addButton('end-game2', self.params.endGame, function () {
      self.showFinalPage();
    }, true);
    this.hideButton('end-game2');
    self.toggleButtonVisibility(STATE_ONGOING);

  };

  /**
   * Find GuessIt in a string and run a handler on those GuessIt
   *
   * @param {string} question
   *   Question text containing GuessIt enclosed in asterisks.
   * @param {function} handler
   *   Replaces the GuessIt text with an input field.
   * @returns {string}
   *   The question with GuessIt replaced by the given handler.
   */
  GuessIt.prototype.handleGuessIt = function (question, handler) {
    // Go through the text and run handler on all asterisk
    let clozeEnd, clozeStart = question.indexOf('*');
    let self = this;
    while (clozeStart !== -1 && clozeEnd !== -1) {
      clozeStart++;
      clozeEnd = question.indexOf('*', clozeStart);
      if (clozeEnd === -1) {
        continue; // No end
      }
      let clozeContent = question.substring(clozeStart, clozeEnd);
      let replacer = '';
      if (clozeContent.length) {
        replacer = handler(self.parseSolution(clozeContent));
        clozeEnd++;
      }
      else {
        clozeStart += 1;
      }
      question = question.slice(0, clozeStart - 1) + replacer + question.slice(clozeEnd);
      clozeEnd -= clozeEnd - clozeStart - replacer.length;

      // Find the next cloze
      clozeStart = question.indexOf('*', clozeEnd);
    }

    return question;
  };

  /**
   * Create questitons html for DOM
   */
  GuessIt.prototype.createQuestions = function (labelId) {
    let self = this;

    let html = '';
    let clozeNumber = 0;
    this.currentSentenceClozes = [];
    this.allClozes = [];

    // Restore previous state (i.e. previsously guessed sentences).
    self.setH5PUserState();

    // Needed for random order (and numchoice)
    self.sentencesGuessed.sort();

    //https://stackoverflow.com/questions/9425009/remove-multiple-elements-from-array-in-javascript-jquery
    for (let i = self.sentencesGuessed.length - 1; i >= 0; i--) {
      self.params.questions.splice(self.sentencesGuessed[i], 1);
    }

    for (let i = 0; i < self.params.questions.length; i++) {
      this.currentSentenceClozes[i] = [];
    }

    for (let i = 0; i < self.params.questions.length; i++) {
      let sentenceClozeNumber = 0;

      // Remove extra blank spaces
      self.params.questions[i].sentence = self.params.questions[i].sentence.replace(/\s+/g, ' ').trim();

      let question = self.params.questions[i].sentence;
      // Replace potential apostrophe entity with apostrophe character!
      if (question.indexOf("&#039;") >= 0) {
        question = question.replace("&#039;", "'");
      }
      // If wordle add forward slashes between each letter
      if (this.params.wordle) {
        question = question.replace(/(.{1})(.{1})(.{1})(.{1})(.{1})/, "$1/$2/$3/$4/$5");
      }

      // Split sentence by blank spaces and potential forward slashes.
      let patternSplit = /(?:\s|\/)+/;
      let patternReplace = /(\s|\/)/g;
      this.sentenceClozeNumber[i] = question.split(patternSplit).length;
      let replacement = '* *';
      question = '*' + question.replace(patternReplace, replacement) + '*';

      // Go through the question text and replace all the asterisks with input fields
      question = self.handleGuessIt(question, function (solution) {
        // Create new cloze
        let defaultUserAnswer = '';
        let cloze = new GuessIt.Cloze(solution, self.params.behaviour, defaultUserAnswer, self.params.wordle, {
          answeredCorrectly: self.params.answeredCorrectly,
          answeredIncorrectly: self.params.answeredIncorrectly,
          solutionLabel: self.params.solutionLabel,
          inputLabel: self.params.inputLabel,
          inputHasTipLabel: self.params.inputHasTipLabel,
          tipLabel: self.params.tipLabel
        });

        self.clozes.push(cloze);
        self.currentSentenceClozes[i].push(cloze);
        // Array used by input Arial text
        self.allClozes.push([clozeNumber, sentenceClozeNumber, self.sentenceClozeNumber[i]]);
        sentenceClozeNumber ++;
        clozeNumber ++;
        return cloze;
      });
      html += '<div class = "h5p-guessit-sentence h5p-guessit-sentence-hidden" id=role="group" aria-labelledby="' + labelId + '">' + question + '</div>';
    }

    self.hasClozes = clozeNumber > 0;
    this.$questions = $(html);

    this.$questions.each(function (index) {
      if (!self.params.wordle) {
        // Set optional tip (for sentence)
        let tip = self.params.questions[index].tip;
        self.addTip(tip, $(this));
      }

      // Set optional audio (for sentence)
      if (self.params.playMode === 'availableSentences') {
        let sound = self.params.questions[index].audio;
        let hidden = self.params.behaviour.displayAudio === 'correct';
        self.addAudio(sound, $(this), hidden);
      }
    });

    // Set input fields.
    this.$questions.find('input').each(function (i) {
      let n = self.allClozes[i][1];
      let t = self.allClozes[i][2];
      self.clozes[i].setInput($(this), '', function () {
      }, n, t);
    }).keyup(function () {
      if (self.params.wordle) {
        let $this = $(this);
        let $inputs;
        $inputs = self.$questions.eq(self.currentSentenceId).find('.h5p-input-wrapper:not(.h5p-correct) .h5p-text-input');
        let letter = $inputs.eq($inputs.index($this)).val();
        // List of European languages accented characters.
        let acceptedEntry = /[a-zàáâãäåæçéèêëìíîïñòóôõöøùúûüýÿ]/.test(letter);
        if (letter && acceptedEntry) {
          let i = 0;
          // If next blank is not empty: move forward to next empty blank.
          if ($inputs.eq($inputs.index($this) + 1).val() ) {
            for (i = $inputs.index($this); i < $inputs.length; i++) {
              if (!$inputs.eq($inputs.index($this) + i).val()) {
                i--;
                break;
              }
            }
          }
          $inputs.eq($inputs.index($this) + 1 + i).focus();
          return;
        }
        else {
          $inputs.eq($inputs.index($this)).val('');
          return false;
        }
      }
    }).keydown(function (event) {
      let $this = $(this);

      // Needed to init timer & counter if enableNumChoice == false
      if (self.$timer === undefined) {
        self.initCounters();
      }

      // Adjust width of text input field to match value
      self.autoGrowTextField($this);

      let $inputs, isLastInput;
      let enterPressed = (event.keyCode === 13);
      let spacePressed = (event.keyCode === 32);
      let tabPressed = (event.keyCode === 9);
      let backTabPressed = (event.keyCode === 8);

      // Figure out which inputs are left to answer in current sentence.
      $inputs = self.$questions.eq(self.currentSentenceId).find('.h5p-input-wrapper:not(.h5p-correct) .h5p-text-input');

      // When going back to delete letters, skip over potential found/correct/disabled inputs.
      if (self.params.wordle && backTabPressed && $inputs.index($this) !== 0) {
        if ($inputs.eq($inputs.index($this)).val() === '') {
          let i = 1;
          while ($inputs.eq($inputs.index($this) - i).is(':disabled')) {
            i++;
          }
          if (($inputs.index($this) - i >= 0)) {
            $inputs.eq($inputs.index($this) - i).val('').focus();
          }
          return;
        }
      }

      if (enterPressed || spacePressed || tabPressed) {
        isLastInput = $this.is($inputs[$inputs.length - 1]);
        if ($inputs.eq($inputs.index($this)).val() === '') {
          return false;
        }
      }

      // If Wordle: test if all blanks have been filled in to enable going to Check button!
      if (self.params.wordle && !isLastInput && (enterPressed || tabPressed)) {
        for (let i = 0; i < $inputs.length; i++) {
          if (!$inputs.eq($inputs.index($this) + i).val()) {
            break;
          }
          isLastInput = true;
        }
      }
      if ((isLastInput && !self.shiftPressed) || (enterPressed && isLastInput)) {
        // Focus first button on next tick
        setTimeout(function () {
          self.focusButton();
        }, 10);
      }

      if (enterPressed || spacePressed || tabPressed) {
        // Do not move forward if current blank is empty!
        if ($inputs.eq($inputs.index($this)).val() !== '') {
          // Find next input to focus
          $inputs.eq($inputs.index($this) + 1).focus();
        }
        else {
          return false;
        }
        return false; // Prevent form submission on enter/tab/space keys

      }
    }).on('change', function () {
      self.answered = true;
      // TODO self.triggerXAPI('interacted');
    });
    self.on('resize', function () {
      self.resetGrowTextField();
    });

    return this.$questions;

  };

  /**
   *
   */
  GuessIt.prototype.autoGrowTextField = function ($input) {
    let self = this;
    let fontSize = parseInt($input.css('font-size'), 10);
    let minEm = 3;
    let minPx = fontSize * minEm;
    let rightPadEm = 3.25;
    let rightPadPx = fontSize * rightPadEm;
    let static_min_pad = 0.5 * fontSize;

    setTimeout(function () {
      let tmp = $('<div>', {
        'text': $input.val()
      });
      tmp.css({
        'position': 'absolute',
        'white-space': 'nowrap',
        'font-size': $input.css('font-size'),
        'font-family': $input.css('font-family'),
        'padding': $input.css('padding'),
        'width': 'initial'
      });
      $input.parent().append(tmp);
      let width = tmp.width();
      let parentWidth = self.$questions.width();
      tmp.remove();
      if (width <= minPx) {
        // Apply min width
        $input.width(minPx + static_min_pad);
      }
      else if (width + rightPadPx >= parentWidth) {
        // Apply max width of parent
        $input.width(parentWidth - rightPadPx);
      }
      else {
        // Apply width that wraps input
        $input.width(width + static_min_pad);
      }
    }, 1);
  };

  /**
   * Resize all text field growth to current size.
   */
  GuessIt.prototype.resetGrowTextField = function () {
    let self = this;

    this.$questions.find('input').each(function () {
      self.autoGrowTextField($(this));
    });
  };

  /**
   * Toggle buttons dependent of state.
   *
   * Using CSS-rules to conditionally show/hide using the data-attribute [data-state]
   */
  GuessIt.prototype.toggleButtonVisibility = function (state) {

    let isFinished = (this.getScore() === this.getMaxScore());

    // The show solutions button is hidden if all answers are correct
    if (this.params.behaviour.enableSolutionsButton) {
      if (state === STATE_CHECKING && !isFinished) {
        this.showButton('show-solution');
      }
      else {
        this.hideButton('show-solution');
      }
    }

    if ((state === STATE_CHECKING && !isFinished) || state === STATE_SHOWING_SOLUTION) {
      this.showButton('try-again');
      if (this.params.behaviour.enableEndGameButton) {
        this.showButton('end-game');
      }
    }
    else {
      this.hideButton('try-again');
      this.hideButton('end-game');
    }

    if (state === STATE_ONGOING) {
      this.showButton('check-answer');
    }
    else {
      this.hideButton('check-answer');
    }

    this.trigger('resize');

  };

  /**
   * Check if solution is allowed. Warn user if not
   */
  GuessIt.prototype.allowSolution = function (option) {
    let isFinished = (this.getScore() === this.getMaxScore());
    if (!isFinished && !this.minRoundsReached()) {
      let minRoundsText = option + ' : ' + this.params.notEnoughRounds
        .replace('@round', this.params.behaviour.numRounds);
      this.updateFeedbackContent(minRoundsText);
      this.read(minRoundsText);
      this.hideButton('show-solution');
      return false;
    }
    return true;
  };

  /**
   * Check if all GuessIt are filled out
   *
   * @method allGuessItFilledOut
   * @return {boolean} Returns true if all GuessIt are filled out.
   */
  GuessIt.prototype.minRoundsReached = function () {
    return (this.counter.getcurrent() > this.params.behaviour.numRounds - 1);
  };

  /**
   * Check if max tries value reached (Wordle).
   */
  GuessIt.prototype.maxTriesReached = function () {
    return (this.counter.getcurrent() > this.params.behaviour.maxTries - 1);
  };

  /**
   * Enable incorrect words for retrying them.
   */
  GuessIt.prototype.enableInCorrectInputs = function () {
    let self = this;
    for (let i = 0; i < self.clozes.length; i++) {
      let ok = self.clozes[i].checkCorrect();
      if (!ok) {
        self.clozes[i].enableInput();
      }
    }
  };
  /**
   * When retrying guessing clean blanks of colours and markup.
   */
  GuessIt.prototype.resetBlanks = function () {
    let self = this;
    for (let i = 0; i < self.clozes.length; i++) {
      let ok = self.clozes[i].checkCorrect();
      if (!ok) {
        self.clozes[i].resetBlank();
        self.clozes[i].setUserInput('');
        self.clozes[i].resetAriaLabel();
      }
    }
  };


  /**
   * Check if all blanks are filled out
   *
   * @method allBlanksFilledOut
   * @return {boolean} Returns true if all blanks are filled out.
   */
  GuessIt.prototype.allBlanksFilledOut = function () {
    return !this.currentSentenceClozes[this.currentSentenceId].some(function (cloze) {
      return !cloze.filledOut();
    });
  };

  /**
   * Mark which answers are correct and which are wrong and disable fields if retry is off.
   */
  GuessIt.prototype.markResults = function () {
    let self = this;
    let currentSentence = '';
    if (self.params.wordle) {
      currentSentence = self.params.questions[self.currentSentenceId].sentence;
    }
    for (let i = 0; i < this.currentSentenceClozes[this.currentSentenceId].length; i++) {
      this.currentSentenceClozes[this.currentSentenceId][i].checkAnswer(currentSentence);
    }
    this.trigger('resize');
  };

  /**
   * Removed marked results
   */
  GuessIt.prototype.removeMarkedResults = function () {
    this.$questions.find('.h5p-input-wrapper').removeClass('h5p-correct h5p-wrong');
    $( '.h5p-guessit-markup').remove();
    this.$questions.find('.h5p-input-wrapper > input').attr('disabled', false);
    this.trigger('resize');
  };

  /**
   * Displays the correct answers
   */
  GuessIt.prototype.showCorrectAnswers = function () {
    let self = this;
    if (!this.allowSolution(self.params.showSolutions)) {
      return;
    }

    if (this.solutionsViewed [this.currentSentenceId] !== true) {
      this.solutionsViewed [this.currentSentenceId] = true;
      this.nbSsolutionsViewed++;
    }
    this.toggleButtonVisibility(STATE_SHOWING_SOLUTION);
    this.hideSolutions();

    for (let i = 0; i < this.clozes.length; i++) {
      this.clozes[i].showSolution();
    }
    this.trigger('resize');
  };

  /**
   * Toggle input allowed for all input fields
   *
   * @method function
   * @param  {boolean} enabled True if fields should allow input, otherwise false
   */
  GuessIt.prototype.toggleAllInputs = function (enabled) {
    for (let i = 0; i < this.clozes.length; i++) {
      this.clozes[i].toggleInput(enabled);
    }
  };

  /**
   * Display the correct solution for the input boxes.
   *
   * This is invoked from CP and QS - be carefull!
   */
  GuessIt.prototype.showSolutions = function () {
    this.params.behaviour.enableSolutionsButton = true;
    this.toggleButtonVisibility(STATE_FINISHED);
    this.markResults();
    this.setFeedback();
    this.showCorrectAnswers(true);
    this.toggleAllInputs(false);
    //Hides all buttons in "show solution" mode.
    this.hideButtons();
  };

  /**
   * Re-attempt guessing current sentence.
   * @public
   */
  GuessIt.prototype.reTry = function () {
    this.answered = false;
    this.hideSolutions();
    this.removeFeedback();
    this.enableInCorrectInputs();
    this.toggleButtonVisibility(STATE_ONGOING);
    this.resetGrowTextField();
    this.done = false;
    this.timer.play();
    this.counter.increment();

    // Clone sentence & feedback
    let $currentQuestion = this.$questions.eq(this.currentSentenceId);
    $currentQuestion.clone(false).addClass('cloned').removeClass('has-tip').insertBefore(this.$questions.eq(this.currentSentenceId));
    let $clonedQuestion = $('[data-content-id="' + this.contentId + '"].h5p-content .cloned');
    $clonedQuestion.find('.h5p-input-wrapper > input').attr('disabled', true);
    $clonedQuestion.find('.joubel-tip-container').addClass('hidden');
    $clonedQuestion.find('.h5p-guessit-audio-wrapper').addClass('hidden');
    this.resetBlanks();
  };

  /**
   * Display a new sentence to be guessed.
   * @public
   */
  GuessIt.prototype.newSentence = function () {
    let self = this;
    this.sentencesFound ++;
    let $content = $('[data-content-id="' + this.contentId + '"].h5p-content');
    $content.find('.cloned').remove();
    let s = self.params.sentence + ' ';
    // Capitalize initial letter
    s = s.charAt(0).toUpperCase() + s.slice(1);
    self.$progress.text(s + (this.sentencesFound + 1) + '/' + this.numQuestions);
    self.initTask();
  };

  GuessIt.prototype.initCounters = function () {
    let self = this;
    let $content = $('[data-content-id="' + self.contentId + '"].h5p-content .h5p-question-content');
    // Timer part.
    this.$timer = $('<div/>', {
      class: 'h5p-guessit time-status',
      tabindex: -1,
      html: '<span role="term" ><em class="fa fa-clock-o" ></em>' +
        self.params.timeSpent + '</span >:' +
        '<span role="definition"  class="h5p-time-spent" >0:00</span>'
    });
    this.timer = new GuessIt.Timer(this.$timer.find('.h5p-time-spent'));

    this.$timer.appendTo($content);
    //this.$timer.addClass ('h5p-guessit-hide');
    this.timer.play();
    // Counter part.
    $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    const counterText = self.params.round
      .replace('@round', '<span class="h5p-counter">1</span>');

    this.$counter = $('<div>', {
      class: 'counter-status',
      tabindex: -1,
      html: '<div role="term"><span role="definition">' + counterText + '</span></div>'
    });
    this.counter = new GuessIt.Counter(this.$counter.find('.h5p-counter'));
    this.$counter.appendTo(this.$timer);
    this.counter.increment();
    // No point displaying sentences progress in userSentence mode OR if Wordle option is selected!
    if (this.params.playMode === 'availableSentences') {
      let s = self.params.sentence + ' ';
      s = s.charAt(0).toUpperCase() + s.slice(1);
      this.$progress = $('<div>', {
        class: 'counter-status',
        tabindex: -1,
        text: s + 1 + '/' + this.numQuestions
      });
      this.$progress.appendTo(this.$timer);
    }

  };

  GuessIt.prototype.initTask = function () {
    let self = this;
    let $content = $('[data-content-id="' + this.contentId + '"].h5p-content');
    $content.find('.h5p-container').removeClass('h5p-guessit-hide');

    if (self.timer !== undefined) {
      this.totalTimeSpent += this.timer.getTime();
      this.totalRounds += this.counter.getcurrent();
      this.$timer.removeClass ('h5p-guessit-hide');
      this.timer.reset();
      this.timer.play();
      this.counter.reset();
    }

    this.hideButton('new-sentence');

    this.hideButton('end-game');
    this.answered = false;
    this.clearAnswers();
    this.removeMarkedResults();
    this.toggleButtonVisibility(STATE_ONGOING);
    this.resetGrowTextField();
    this.toggleAllInputs(true);
    this.done = false;

    // Hide current sentence and mark it as "used"
    this.$questions.eq(this.currentSentenceId).addClass('h5p-guessit-sentence-hidden used');
    this.numQuestionsInWords[this.numWords] --;
    let acceptedQuestions = [];
    let i;
    if (this.params.behaviour.enableNumChoice) {
      for (i = 0; i < this.params.questions.length; i++) {
        if (this.sentenceClozeNumber[i] === this.numWords && !this.$questions.eq(i).hasClass('used')) {
          acceptedQuestions[i] = i;
        }
      }
    }
    else {
      for (i = 0; i < this.numQuestions; i++) {
        if (!this.$questions.eq(i).hasClass('used')) {
          acceptedQuestions[i] = i;
        }
      }
    }

    // https://alligator.io/js/filter-array-method/
    acceptedQuestions = acceptedQuestions.filter(function (number) {
      return number !== null;
    });
    if (this.params.playMode === 'userSentence') {
      acceptedQuestions = [0];
    }
    if (this.params.behaviour.sentencesOrder === 'normal') {
      this.currentSentenceId = acceptedQuestions[0];
    }
    else {
      // https://www.w3resource.com/javascript-exercises/javascript-array-exercise-35.php
      // Note ~~ equivalent of Math.floor See http://rocha.la/JavaScript-bitwise-operators-in-practice
      this.currentSentenceId = acceptedQuestions[~~(Math.random() * acceptedQuestions.length)];
    }
    this.$questions.eq(this.currentSentenceId).removeClass('h5p-guessit-sentence-hidden');

    if (this.params.playMode === 'userSentence') {
      this.currentSentenceId = 0;
      this.$questions.eq(this.currentSentenceId).removeClass('h5p-guessit-sentence-hidden');
    }

  };

  GuessIt.prototype.showFinalPage = function () {
    let self = this;
    this.hideButton('end-game');
    this.hideButton('try-again');
    let $content = $('[data-content-id="' + self.contentId + '"].h5p-content');

    // Needed to display 'h5p-guessit-summary-screen' centered!
    $content.removeClass('h5p-no-frame');

    // Remove all these now useless elements from DOM.
    $content = $('[data-content-id="' + self.contentId + '"].h5p-content');

    $('.h5p-no-frame, .h5p-guessit-description, .h5p-question-introduction, .h5p-question-content,'
      + ' .h5p-question-scorebar, .h5p-question-feedback',
    $content).hide();

    this.totalRounds += this.counter.getcurrent();

    // Calculate and nicely format total time spent.
    this.totalTimeSpent += this.timer.getTime();
    let time = this.totalTimeSpent / 1000;
    // https://stackoverflow.com/questions/3733227/javascript-seconds-to-minutes-and-seconds#3733257
    function fancyTimeFormat(time) {
      // Hours, minutes and seconds
      let hrs = ~~(time / 3600);
      let mins = ~~((time % 3600) / 60);
      let secs = ~~time % 60;
      let ret = "";
      // Using international SI abreviations.
      const $hour = 'h';
      const $minute = 'min';
      const $second = 's';
      if (hrs > 0) {
        ret += "" + hrs + $hour + (mins < 10 ? "0" : "");
      }
      ret += "" + mins + ' ' + $minute + ' ' + (secs < 10 ? "0" : "");
      ret += "" + secs + ' ' + $second;
      return ret;
    }
    this.totalTime = fancyTimeFormat(time);

    // Calculate the number of sentences that have been guessed.
    let usedQuestions = 1;
    for (let i = 0; i < this.params.questions.length; i++) {
      if (this.$questions.eq(i).hasClass('used')) {
        usedQuestions ++;
      }
    }
    let actualScore;
    let maxScore;
    let explainScore;

    actualScore = this.nbSentencesGuessed;
    if (!this.params.wordle) {
      if (!this.params.behaviour.enableNumChoice) {
        maxScore = this.totalNumQuestions;
        explainScore = this.params.scoreExplanationforAllSentences;
      }
      else {
        maxScore = this.numQuestions;
        explainScore = this.params.scoreExplanationforSentencesWithNumberWords
          .replace('@words', this.numWords);
      }
    }
    else {
      maxScore = this.nbSentencesGuessed + this.wordsNotFound.length;
      explainScore = this.params.scoreExplanationforAllWords;
    }

    if (actualScore === maxScore) {
      this.success = true;
    }
    this.actualScore = actualScore;
    this.maxScore = maxScore;
    // We only trigger XAPI at the end of the activity
    self.triggerAnswered();
    this.hideButton('end-game2');
    this.hideButton('new-sentence');
    this.$timer.remove();
    let txtGuessed = this.params.sentencesGuessed;
    if (this.params.wordle) {
      txtGuessed = this.params.wordsFound;
    }
    let $outof = '<td class="h5p-guessit-summary-table-row-category">' + txtGuessed + '</td>'
      + '<td class="h5p-guessit-summary-table-row-symbol h5p-guessit-check">&nbsp;</td>'
      + '<td class="h5p-guessit-summary-table-row-score">'
      + this.nbSentencesGuessed
      + '&nbsp;<span class="h5p-guessit-summary-table-row-score-divider">/</span>&nbsp;'
      + maxScore + '</td></tr>';
    if (this.params.playMode === 'userSentence') {
      $outof = '';
    }
    let text = '<div class="h5p-guessit-summary-header">'
      + this.params.summary + '</div>'
      + '<table class="h5p-guessit-summary-table">'
      + $outof
      + '<tr><td class="h5p-guessit-summary-table-row-category">' + this.params.totalRounds + '</td>'
      + '<td class="h5p-guessit-summary-table-row-symbol"></td>'
      + '<td class="h5p-guessit-summary-table-row-score">' + this.totalRounds + '</td></tr>';
    if (!this.params.wordle) {
      text  += '<tr><td class="h5p-guessit-summary-table-row-category">' + this.params.solutionsViewed + '</td>'
        + '<td class="h5p-guessit-summary-table-row-symbol"></td>'
        + '<td class="h5p-guessit-summary-table-row-score">' + this.nbSsolutionsViewed + '</td></tr>';
    }

    text += '<tr><td colspan="3" class="h5p-guessit-summary-table-row-category">'
      + this.params.totalTimeSpent + ' :<span style = "float: right;">&nbsp;' + this.totalTime +  '</span></td>'
      + '<td class="">' + '</td>'
      + '<td class="">' + '</td></tr>'
      + '</table>';

    $content = $('[data-content-id="' + self.contentId + '"] .h5p-container');

    let $feedback = $('<div>', {
      'class': 'h5p-guessit-summary-screen',
      'html': text
    }).appendTo($content);

    if (this.$divGuessedSentences) {
      this.$divGuessedSentences.prependTo($feedback);
    }

    this.$feedbackContainer = $('<div class="h5p-guessit feedback-container"/>')
      .appendTo($feedback);
    if (this.params.playMode === 'availableSentences') {
      let scoreBarLabel = this.params.scoreBarLabel.replace('@score', actualScore).replace('@total', maxScore);
      let scoreBar = H5P.JoubelUI.createScoreBar(maxScore, scoreBarLabel, explainScore, this.params.scoreExplanationButtonLabel);
      scoreBar.setMaxScore(maxScore);
      scoreBar.setScore(actualScore);
      scoreBar.appendTo(this.$feedbackContainer);
    }
    this.trigger('resize');

    // Reset all user state elements.
    if (usedQuestions === this.params.questions.length) {
      //this.sentencesList = '';
      this.sentencesGuessed.length = 0;
      this.wordsNotFound.length = 0;
      this.nbSentencesGuessed = 0;
      this.totalRounds = 0;
      this.nbSsolutionsViewed = 0;
      this.totalTimeSpent = 0;
      self.getCurrentState();
    }

    // Display reset button to enable user to do the task again.
    // Provided a warning in the semantics file as to this method not guaranteed to work at all times!
    if (this.params.behaviour.enableRetry) {
      H5P.JoubelUI.createButton({
        'class': 'h5p-guessit-retry-button',
        'title': self.params.tryAgain,
        'html': self.params.tryAgain
      }).click(function () {
        let url = top.location.href;
        window.top.location.href = url;
      }).appendTo(this.$feedbackContainer)
        .focus();
    }
  };

  /**
   * Hides all buttons.
   * @public
   */
  GuessIt.prototype.hideButtons = function () {
    this.toggleButtonVisibility(STATE_FINISHED);
  };

  /**
   * Trigger xAPI answered event
   */
  GuessIt.prototype.triggerAnswered = function () {
    this.answered = true;
    let xAPIEvent = this.createXAPIEventTemplate('answered');
    this.addQuestionToXAPI(xAPIEvent);
    this.addResponseToXAPI(xAPIEvent);
    this.trigger(xAPIEvent);
  };

  /**
   * Get xAPI data.
   * Contract used by report rendering engine.
   *
   * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   */
  GuessIt.prototype.getXAPIData = function () {
    let xAPIEvent = this.createXAPIEventTemplate('answered');
    this.addQuestionToXAPI(xAPIEvent);
    this.addResponseToXAPI(xAPIEvent);
    return {
      statement: xAPIEvent.data.statement
    };
  };

  /**
   * Generate xAPI object definition used in xAPI statements.
   * @return {Object}
   */
  GuessIt.prototype.getxAPIDefinition = function () {
    let definition = {};
    if (!this.params.wordle) {
      definition.description = {
        'en-US': this.params.sentencesGuessed
      };
    }
    else {
      definition.description = {
        'en-US': this.params.wordsFound
      };
    }
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'long-fill-in';
    return definition;
  };

  /**
   * Add the question itselt to the definition part of an xAPIEvent
   */
  GuessIt.prototype.addQuestionToXAPI = function (xAPIEvent) {
    let definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
    $.extend(true, definition, this.getxAPIDefinition());

    // Set reporting module version if alternative extension is used
    if (this.hasAlternatives) {
      const context = xAPIEvent.getVerifiedStatementValue(['context']);
      context.extensions = context.extensions || {};
      context.extensions[XAPI_REPORTING_VERSION_EXTENSION] = '1.1.0';
    }
  };


  /**
   * Parse the solution text (text between the asterisks)
   *
   * @param {string} solutionText
   * @returns {object} with the following properties
   *  - solutions: array of solution words JR in guessIt, this array consists of one word only.
   */
  GuessIt.prototype.parseSolution = function (solutionText) {
    return {
      solutions: solutionText.split()
    };
  };
  /**
   * Add the response part to an xAPI event
   *
   * @param {H5P.XAPIEvent} xAPIEvent
   *  The xAPI event we will add a response to
   * change last param to this.isPassed() TODO!
   */
  GuessIt.prototype.addResponseToXAPI = function (xAPIEvent) {
    xAPIEvent.setScoredResult(this.actualScore, this.maxScore, this,
      true, this.success);
    xAPIEvent.data.statement.result.response = this.getxAPIResponse(this.originalQuestions);
  };

  /**
   * Generate xAPI user response, used in xAPI statements.
   * @return {string} User answers separated by the "[,]" pattern
   */
  GuessIt.prototype.getxAPIResponse = function (questions) {
    let self = this;
    let guessedSentences = '';
    // TODO add tried sentences? + add timespent & nb turns & solutions asked for each or all???
    this.sentencesGuessed.forEach(function (item) {
      let foundSentence = questions[item].sentence;
      if (self.params.wordle) {
        let i = self.wordsNotFound.indexOf(item);
        let wordGuessed = true;
        if (i !== -1) {
          wordGuessed = false;
        }
        if (wordGuessed) {
          foundSentence = self.params.wordFound + foundSentence;
        }
        else {
          foundSentence = self.params.wordNotFound + foundSentence;
        }
      }
      guessedSentences += (!guessedSentences ? '' : '\n') + foundSentence;
    });
    guessedSentences += '\n------------------------\n'
      + this.params.totalRounds + ' : ' + this.totalRounds + '\n'
      + this.params.solutionsViewed + ' : ' + this.nbSsolutionsViewed;
    return guessedSentences;
  };

  /**
   * Hide solutions. (/try again)
   */
  GuessIt.prototype.hideSolutions = function () {
    // Clean solution from quiz
    this.$questions.find('.h5p-correct-answer').remove();
  };

  /**
   * Get maximum number of correct answers.
   *
   * @returns {Number} Max points
   */
  GuessIt.prototype.getMaxScore = function () {
    return this.sentenceClozeNumber[this.currentSentenceId];
  };

  /**
   * Count the number of correct answers.
   *
   * @returns {Number} Points
   */
  GuessIt.prototype.getScore = function () {
    let self = this;
    let correct = 0;

    for (let i = 0; i < self.clozes.length; i++) {
      if (self.clozes[i].correct()) {
        correct++;
      }
      if (self.clozes[i].getUserAnswer() !== '') {
        //this.userAnswers[i] = self.clozes[i].getUserAnswer();
      }
    }

    return correct;
  };

  GuessIt.prototype.getTitle = function () {
    return H5P.createTitle((this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Fill In');
  };

  /**
   * Clear the user's answers
   */
  GuessIt.prototype.clearAnswers = function () {
    this.clozes.forEach(function (cloze) {
      cloze.setUserInput('');
      cloze.resetAriaLabel();
    });
  };

  /**
   * Checks if all has been answered.
   *
   * @returns {Boolean}
   */
  GuessIt.prototype.getAnswerGiven = function () {
    return this.answered || !this.hasClozes;
  };

  /**
   * Helps set focus the given input field.
   * @param {jQuery} $input
   */
  GuessIt.prototype.setFocus = function ($input) {
    setTimeout(function () {
      $input.focus();
    }, 1);
  };

  /**
   * Returns an object containing content of each cloze
   *
   * @returns {object} object containing content for each cloze
   */
  GuessIt.prototype.getCurrentState = function () {
    let state = {};
    state.originalQuestions = this.originalQuestions;
    state.sentencesGuessed = this.sentencesGuessed;
    state.wordsNotFound = this.wordsNotFound;
    state.nbSentencesGuessed = this.nbSentencesGuessed;
    state.totalRounds = this.totalRounds;
    state.nbSsolutionsViewed = this.nbSsolutionsViewed;
    state.totalTimeSpent = this.totalTimeSpent;
    return state;
  };

  /**
   * Sets answers to current user state
   */
  GuessIt.prototype.setH5PUserState = function () {
    let isValidState = (this.previousState !== undefined
      && Object.keys(this.previousState).length !== 0);

    // Check that stored user state is valid
    if (!isValidState) {
      return;
    }
    this.originalQuestions = this.previousState.originalQuestions;
    this.sentencesGuessed = this.previousState.sentencesGuessed;
    this.wordsNotFound = this.previousState.wordsNotFound;
    this.nbSentencesGuessed = this.previousState.nbSentencesGuessed;
    this.totalRounds = this.previousState.totalRounds;
    this.nbSsolutionsViewed = this.previousState.nbSsolutionsViewed;
    this.totalTimeSpent = this.previousState.totalTimeSpent;
  };

  /**
   * Disables any active input. Useful for freezing the task and dis-allowing
   * modification of wrong answers.
   */
  GuessIt.prototype.disableInput = function () {
    this.$questions.find('input').attr('disabled', true);
  };
  /**
   * Generate xAPI object definition used in xAPI statements.
   * @return {Object}
   */
  /*
  GuessIt.prototype.getxAPIDefinition = function () {
    var definition = {};
    definition.description = {
      'en-US': this.params.description
    };
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'fill-in';
    return definition;
  };
*/
  GuessIt.prototype.eventCompleted = function () {
    // Create and trigger xAPI event 'completed'
    let completedEvent = this.createXAPIEventTemplate('completed');
    completedEvent.setScoredResult(1, 1, self, true, true);
    completedEvent.data.statement.result.duration = 'PT' + (Math.round(this.timer.getTime() / 10) / 100) + 'S';
    this.trigger(completedEvent);
  };

  GuessIt.prototype.addTip = function (tip, question) {
    let self = this;
    let tipLabel = self.params.tipLabel;
    if (tip !== undefined && tip.trim().length > 0) {
      question.addClass('has-tip')
        .prepend(H5P.JoubelUI.createTip(tip, {
          tipLabel: tipLabel
        }));
    }
    // Remove default bubble & shadow elements from the default H5P tip button since they are not used.
    question.find('.h5p-icon-speech-bubble, .h5p-icon-shadow').remove();
  };

  GuessIt.prototype.addAudio = function (sound, question, hidden) {
    let self = this;
    if (sound !== undefined) {
      let $audioWrapper = $('<div>', {
        'class': 'h5p-guessit-audio-wrapper'
      });
      if (hidden) {
        $audioWrapper.addClass('hidden');
      }
      let audioDefaults = {
        files: sound,
        audioNotSupported: self.params.audioNotSupported
      };
      let audio = new H5P.Audio(audioDefaults, self.contentId);
      audio.attach($audioWrapper);
      // Prepend potential audio buttons to the sentence input fields.
      question.prepend($audioWrapper);
    }
  };

  GuessIt.idCounter = 0;

  return GuessIt;
})(H5P.jQuery, H5P.Question);
