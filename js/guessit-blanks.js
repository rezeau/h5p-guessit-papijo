/*global H5P*/
H5P.GuessIt = (function ($, Question, JoubelUI) {
  /**
   * @constant
   * @default
   */
  var STATE_ONGOING = 'ongoing';
  var STATE_CHECKING = 'checking';
  var STATE_SHOWING_SOLUTION = 'showing-solution';
  var STATE_FINISHED = 'finished';

  const XAPI_ALTERNATIVE_EXTENSION = 'https://h5p.org/x-api/alternatives';
  const XAPI_CASE_SENSITIVITY = 'https://h5p.org/x-api/case-sensitivity';
  const XAPI_REPORTING_VERSION_EXTENSION = 'https://h5p.org/x-api/h5p-reporting-version';

  /**
   * @typedef {Object} Params
   *  Parameters/configuration object for GuessIt
   *
   * @property {Object} Params.behaviour
   * @property {string} Params.behaviour.confirmRetryDialog
   * @property {string} Params.behaviour.confirmCheckDialog
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
    var self = this;
    var $wrapper;
    // Inheritance. User for CSS!
    Question.call(self, 'guessit');

    // IDs
    this.contentId = id;
    this.contentData = contentData;

    this.params = $.extend(true, {}, {
      text: "Fill in",
      questions: [
        "Oslo is the capital of *Norway*."
      ],
      showSolutions: "Show solution",
      tryAgain: "Try again",
      resetGame: 'Reset the game',
      checkAnswer: "Check",
      notEnoughRounds: "The solution won't be available before round @round",
      answerIsCorrect: "':ans' is correct",
      answerIsWrong: "':ans' is wrong",
      answeredCorrectly: "Answered correctly",
      answeredIncorrectly: "Answered incorrectly",
      solutionLabel: "Correct answer:",
      inputLabel: "Blank input @num of @total",
      inputHasTipLabel: "Tip available",
      round: "Round @round",
      timeSpent: "Time Spent",
      tipLabel: "Tip",
      scoreBarLabel: 'You got :num out of :total points',
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        numRounds: 1,
        enableCheckButton: true,
        caseSensitive: true,        
        autoCheck: false,
        keepCorrectAnswers: false
      }
    }, params);

    // Delete empty questions
    for (var i = this.params.questions.length - 1; i >= 0; i--) {
      if (!this.params.questions[i].sentence) {
        this.params.questions.sentence.splice(i, 1);
      }
    }

    // Previous state
    this.contentData = contentData;
    if (this.contentData !== undefined && this.contentData.previousState !== undefined) {
      this.previousState = this.contentData.previousState;
    }

    // Clozes
    this.clozes = [];

    // Init userAnswers
    this.userAnswers = [];
    
    // Init currentSentence values
    this.sentenceClozeNumber = [];
    
    this.currentSentenceId = 0;

    // Keep track tabbing forward or backwards
    this.shiftPressed = false;
    
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
  GuessIt.prototype.registerDomElements = function () {
    var self = this;

    // Using instructions as label for our text groups
    const labelId = 'h5p-GuessIt-instructions-' + GuessIt.idCounter;

    // Register task introduction text
    self.setIntroduction('<div id="' + labelId + '">' + self.params.text + '</div>');

    // Register task content area
    self.setContent(self.createQuestions(labelId), {
    });

    // ... and buttons
    self.registerButtons();

    // Restore previous state
    self.setH5PUserState();
    
// timer part
    this.$timer = $('<div/>', {
      class: 'h5p-guessit time-status',
      tabindex: 0,
      html: '<span role="term" ><em class="fa fa-clock-o" ></em>' +
        self.params.timeSpent + '</span >:' +
        '<span role="definition"  class="h5p-time-spent" >0:00</span>'
    });
    this.timer = new GuessIt.Timer(this.$timer.find('.h5p-time-spent'));
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    this.$timer.appendTo($content);
    this.timer.play();
    
    // counter part
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    const counterText = self.params.round
      .replace('@round', '<span class="h5p-counter">0</span>');

    this.$counter = $('<div/>', {
      class: 'counter-status',
      tabindex: 0,
      html: '<div role="term"><span role="definition">' + counterText + '</span></div>'
    });
    this.counter = new GuessIt.Counter(this.$counter.find('.h5p-counter'));
    this.$counter.appendTo(this.$timer);
    this.counter.increment();
  };

  /**
   * Create all the buttons for the task
   */
  GuessIt.prototype.registerButtons = function (JOUBELUI) {
    var self = this;

    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    var $containerParents = $content.parents('.h5p-container');

    // select find container to attach dialogs to
    var $container;
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

    if (!self.params.behaviour.autoCheck && this.params.behaviour.enableCheckButton) {
      // Check answer button
      self.addButton('check-answer', self.params.checkAnswer, function () {
        self.toggleButtonVisibility(STATE_CHECKING);
        self.markResults();
        self.showEvaluation();
        self.triggerAnswered();
        self.timer.stop();
      });
    }

    // Show solution button
    self.addButton('show-solution', self.params.showSolutions, function () {
      self.showCorrectAnswers(false);
    }, self.params.behaviour.enableSolutionsButton);

    // Try again button
    
    if (self.params.behaviour.enableRetry === true) {
      self.addButton('try-again', self.params.tryAgain, function () {
        self.reTry();
        self.$questions.filter(':first').find('input:first').focus();
      });
    }
    
    // Reset button    
    self.addButton('reset-task', self.params.resetGame, function () {
      self.resetTask();
    }, true, {}, {
        confirmationDialog: {
          enable: self.params.behaviour.confirmResetDialog,
          l10n: self.params.confirmReset,
          instance: self,
          $parentElement: $container
        }
      });
    
    this.hideButton('reset-task');
    
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
    var clozeEnd, clozeStart = question.indexOf('*');
    var self = this;
    while (clozeStart !== -1 && clozeEnd !== -1) {
      clozeStart++;
      clozeEnd = question.indexOf('*', clozeStart);
      if (clozeEnd === -1) {
        continue; // No end
      }
      var clozeContent = question.substring(clozeStart, clozeEnd);
      var replacer = '';
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
    var self = this;
    
    var html = '';
    var clozeNumber = 0;
    
    // TODO put this in a function?
    var min = 0; 
    var max = self.params.questions.length - 1;  
    var random = Math.floor(Math.random() * (max - min + 1) ) + min;
    this.currentSentenceClozes = []
    for(var i = 0; i < self.params.questions.length; i++) {
      this.currentSentenceClozes[i] = [];
    }
    
    this.currentSentenceId = random;
    var closeNumber = 0;
    for (var i = 0; i < self.params.questions.length; i++) {
      var question = self.params.questions[i].sentence;
      // Replace potential apostrophe entity with apostrophe character!
      if (question.indexOf("&#039;") >= 0) {
         question = question.replace("&#039;", "'");
      }
      this.sentenceClozeNumber[i] = question.split(' ').length;
      
      // JR add asterisks around all words in sentence!
      var pattern = /\s/g;     
      var replacement = '* *';
      question = '*' + question.replace(pattern, replacement) + '*';

      // Go through the question text and replace all the asterisks with input fields
      question = self.handleGuessIt(question, function (solution) {
        // Create new cloze
        
        var defaultUserAnswer = '';
        var cloze = new GuessIt.Cloze(solution, self.params.behaviour, defaultUserAnswer, {
          answeredCorrectly: self.params.answeredCorrectly,
          answeredIncorrectly: self.params.answeredIncorrectly,
          solutionLabel: self.params.solutionLabel,
          inputLabel: self.params.inputLabel,
          inputHasTipLabel: self.params.inputHasTipLabel,
          tipLabel: self.params.tipLabel
        });
        self.clozes.push(cloze);
        self.currentSentenceClozes[i].push(cloze);        
        return cloze;
      });
     
      html += '<div class = "h5p-guessit-sentence h5p-guessit-sentence-hidden" id=role="group" aria-labelledby="' + labelId + '">' + question + '</div>';
    }

    self.hasClozes = clozeNumber > 0;
    this.$questions = $(html);

    // Set optional tip
    var tipLabel = this.params.tipLabel;
    var inputLabel = this.params.tipLabel;
    this.$questions.each(function (index) {
      var tip = self.params.questions[index].tip;
      if(tip !== undefined && tip.trim().length > 0) {
        $(this).addClass('has-tip')
          .prepend(H5P.JoubelUI.createTip(tip, {
            tipLabel: tipLabel 
          }));
        inputLabel = inputLabel;
      }
    });
    
    // Set input fields.
    this.$questions.find('input').each(function (i) {
      var afterCheck;
      if (self.params.behaviour.autoCheck) {
        afterCheck = function () {
          var answer = $("<div>").text(this.getUserAnswer()).html();
          self.read((this.correct() ? self.params.answerIsCorrect : self.params.answerIsWrong).replace(':ans', answer));
          if (self.done || self.allGuessItFilledOut()) {
            // All answers has been given. Show solutions button.
            self.toggleButtonVisibility(STATE_CHECKING);
            self.triggerAnswered();
            self.done = true;
          }
        };
      }
      
      // JR  TODO i, self.clozes.length); remplacer par index current sentence clozes et total number clozed in current sentence
      // PREVIOUSLY create arrays holding those numbers
      // guessItCloses [i][index][nbClozes]
      self.clozes[i].setInput($(this), afterCheck, function () {
        self.toggleButtonVisibility(STATE_ONGOING);        
        self.hideEvaluation();
      }, i, self.clozes.length);
    }).keydown(function (event) {
      var $this = $(this);

      // Adjust width of text input field to match value
      self.autoGrowTextField($this);

      var $inputs, isLastInput;
      var enterPressed = (event.keyCode === 13);
      var tabPressedAutoCheck = (event.keyCode === 9 && self.params.behaviour.autoCheck);

      if (enterPressed || tabPressedAutoCheck) {
        // Figure out which inputs are left to answer
        $inputs = self.$questions.find('.h5p-input-wrapper:not(.h5p-correct) .h5p-text-input');

        // Figure out if this is the last input
        isLastInput = $this.is($inputs[$inputs.length - 1]);
      }

      if ((tabPressedAutoCheck && isLastInput && !self.shiftPressed) ||
          (enterPressed && isLastInput)) {
        // Focus first button on next tick
        setTimeout(function () {
          self.focusButton();
        }, 10);
      }

      if (enterPressed) {
        if (isLastInput) {
          // Check answers
          $this.trigger('blur');
        }
        else {
          // Find next input to focus
          $inputs.eq($inputs.index($this) + 1).focus();
        }

        return false; // Prevent form submission on enter key
      }
    }).on('change', function () {
      self.answered = true;
      self.triggerXAPI('interacted');
    });

    self.on('resize', function () {
      self.resetGrowTextField();
    });
    
    
    
    // JR TODO un-hide one randomly selected question
    // needs re-working of course
    
    this.$questions.eq(random).removeClass('h5p-guessit-sentence-hidden');
    
      
    return this.$questions;
  };

  /**
   *
   */
  GuessIt.prototype.autoGrowTextField = function ($input) {
    var self = this;
    var fontSize = parseInt($input.css('font-size'), 10);
    var minEm = 3;
    var minPx = fontSize * minEm;
    var rightPadEm = 3.25;
    var rightPadPx = fontSize * rightPadEm;
    var static_min_pad = 0.5 * fontSize;

    setTimeout(function () {
      var tmp = $('<div>', {
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
      var width = tmp.width();
      var parentWidth = self.$questions.width();
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
    var self = this;

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
    // The show solutions button is hidden if all answers are correct
    var isFinished = (this.getScore() === this.getMaxScore());
    if (isFinished) {
      this.timer.reset();
      // We are viewing the solutions
      state = STATE_FINISHED;
      this.showButton('reset-task');
    }

    if (this.params.behaviour.enableSolutionsButton) {
      if (state === STATE_CHECKING && !isFinished) {
        // JR TODO rework the conditions maybe after so many tries? to be parametered?
        this.showButton('show-solution');
      }
      else {
        this.hideButton('show-solution');
      }
    }

    if (this.params.behaviour.enableRetry) {
      if ((state === STATE_CHECKING && !isFinished) || state === STATE_SHOWING_SOLUTION) {
        this.showButton('try-again');
      }
      else {
        this.hideButton('try-again');
      }
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
  GuessIt.prototype.allowSolution = function () {
    //if (this.params.behaviour.numRounds > 0) {
      if (!this.minRoundsReached()) {
      var minRoundsText = this.params.notEnoughRounds
        .replace('@round', this.params.behaviour.numRounds);
        this.updateFeedbackContent(minRoundsText);
        this.read(minRoundsText);
        this.hideButton('show-solution');
        return false;
      }
    //}
    return true;
  };

  /**
   * Check if all GuessIt are filled out
   *
   * @method allGuessItFilledOut
   * @return {boolean} Returns true if all GuessIt are filled out.
   */
  GuessIt.prototype.minRoundsReached = function () {
    console.log('this.params.behaviour.numRounds = ' + this.params.behaviour.numRounds 
      + ' this.counter = ' + this.counter.getcurrent())
    
    return (this.counter.getcurrent() > this.params.behaviour.numRounds - 1)
  };

  /**
   * Enable incorrect words for retrying them.
   */
  GuessIt.prototype.enableInCorrectInputs = function () {
    var self = this;
    for (var i = 0; i < self.clozes.length; i++) {
      var ok = self.clozes[i].checkCorrect();
      if (!ok) {
        self.clozes[i].enableInput();
      }
    }    
  };

  /**
   * Mark which answers are correct and which are wrong and disable fields if retry is off.
   */
  GuessIt.prototype.markResults = function () {
    var self = this;
    //for (var i = 0; i < self.clozes.length; i++) {
    for (var i = 0; i < this.currentSentenceClozes[this.currentSentenceId].length; i++) {
    
      this.currentSentenceClozes[this.currentSentenceId][i].checkAnswer(this.defaultDiacriticsRemovalMap);
      if (!self.params.behaviour.enableRetry) {
        self.clozes[i].disableInput();
      }
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
    if (!this.allowSolution()) {
      return;
    }

    this.toggleButtonVisibility(STATE_SHOWING_SOLUTION);
    this.hideSolutions();

    for (var i = 0; i < this.clozes.length; i++) {
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
    for (var i = 0; i < this.clozes.length; i++) {
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
    this.showEvaluation();
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
    this.hideEvaluation();
    if (!this.params.behaviour.keepCorrectAnswers) {
      this.clearAnswers();
      this.removeMarkedResults();
      this.toggleAllInputs(true);
    } else {
      this.$questions.find('.h5p-input-wrapper').removeClass('h5p-wrong');
      this.enableInCorrectInputs();
    }
    this.toggleButtonVisibility(STATE_ONGOING);
    this.resetGrowTextField();
    this.done = false;
    this.timer.play();
    this.counter.increment();
  };

  /**
   * Resets the complete task.
   * Used in contracts.
   * @public
   */
  GuessIt.prototype.resetTask = function () {
  
    this.timer.reset();
    this.timer.play();
    this.counter.reset();
    this.hideButton('reset-task');
    this.answered = false;
    this.hideEvaluation();
    this.hideSolutions();
    this.clearAnswers();
    this.removeMarkedResults();
    this.toggleButtonVisibility(STATE_ONGOING);
    this.resetGrowTextField();
    this.toggleAllInputs(true);
    this.done = false;
    this.$questions.eq(this.currentSentenceId).addClass('h5p-guessit-sentence-hidden');
    var min = 0; 
    var max = this.params.questions.length - 1;  
    var random = Math.floor(Math.random() * (max - min + 1) ) + min;
    this.currentSentenceId = random; 
    this.$questions.eq(this.currentSentenceId).removeClass('h5p-guessit-sentence-hidden');
    //this.reTry();    
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
    var xAPIEvent = this.createXAPIEventTemplate('answered');
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
    var xAPIEvent = this.createXAPIEventTemplate('answered');
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
    var definition = {};
    definition.description = {
      'en-US': this.params.text
    };
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'fill-in';

    const clozeSolutions = [];
    let crp = '';
    // xAPI forces us to create solution patterns for all possible solution combinations
    for (var i = 0; i < this.params.questions.length; i++) {
      var question = this.handleGuessIt(this.params.questions[i].sentence, function (solution) {
        // Collect all solution combinations for the H5P Alternative extension
        clozeSolutions.push(solution.solutions);

        // Create a basic response pattern out of the first alternative for each GuessIt field
        crp += (!crp ? '' : '[,]') + solution.solutions[0];

        // We replace the solutions in the question with a "blank"
        return '__________';
      });
      definition.description['en-US'] += question;
    }

    // Set the basic response pattern (not supporting multiple alternatives for GuessIt)
    definition.correctResponsesPattern = [
      '{case_matters=' + this.params.behaviour.caseSensitive + '}' + crp,
    ];

    // Add the H5P Alternative extension which provides all the combinations of different answers
    // Reporting software will need to support this extension for alternatives to work.
    definition.extensions = definition.extensions || {};
    definition.extensions[XAPI_CASE_SENSITIVITY] = this.params.behaviour.caseSensitive;
    definition.extensions[XAPI_ALTERNATIVE_EXTENSION] = clozeSolutions;

    return definition;
  };

  /**
   * Add the question itselt to the definition part of an xAPIEvent
   */
  GuessIt.prototype.addQuestionToXAPI = function (xAPIEvent) {
    var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
    $.extend(true, definition, this.getxAPIDefinition());

    // Set reporting module version if alternative extension is used
    if (definition.extensions && definition.extensions[XAPI_ALTERNATIVE_EXTENSION]) {
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
   */
  GuessIt.prototype.addResponseToXAPI = function (xAPIEvent) {
    xAPIEvent.setScoredResult(this.getScore(), this.getMaxScore(), this);
    xAPIEvent.data.statement.result.response = this.getxAPIResponse();
  };

  /**
   * Generate xAPI user response, used in xAPI statements.
   * @return {string} User answers separated by the "[,]" pattern
   */
  GuessIt.prototype.getxAPIResponse = function () {
    var usersAnswers = this.getCurrentState();
    return usersAnswers.join('[,]');
  };
  /**
   * Show evaluation widget, i.e: 'You got x of y blanks correct'
   */
  GuessIt.prototype.showEvaluation = function () {
    var maxScore = this.getMaxScore();
    var score = this.getScore();
    this.setFeedback('', score, maxScore, this.params.scoreBarLabel);
    if (score === maxScore) {
      this.toggleButtonVisibility(STATE_FINISHED);
    }
    
  };

  /**
   * Hide the evaluation widget
   */
  GuessIt.prototype.hideEvaluation = function () {
    // Clear evaluation section.
    this.removeFeedback();
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
    var self = this;
    return this.sentenceClozeNumber[this.currentSentenceId];
    //return self.clozes.length;
  };

  /**
   * Count the number of correct answers.
   *
   * @returns {Number} Points
   */
  GuessIt.prototype.getScore = function () {
    var self = this;
    var correct = 0;
    for (var i = 0; i < self.clozes.length; i++) {
      if (self.clozes[i].correct()) {
        correct++;
      }
      //self.params.userAnswers[i] = self.clozes[i].getUserAnswer();
      this.userAnswers[i] = self.clozes[i].getUserAnswer();
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
  GuessIt.setFocus = function ($input) {
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
    var clozesContent = [];

    // Get user input for every cloze
    this.clozes.forEach(function (cloze) {
      clozesContent.push(cloze.getUserInput());
    });
    return clozesContent;
  };

  /**
   * Sets answers to current user state
   */
  GuessIt.prototype.setH5PUserState = function () {
    var self = this;
    var isValidState = (this.previousState !== undefined &&
                        this.previousState.length &&
                        this.previousState.length === this.clozes.length);

    // Check that stored user state is valid
    if (!isValidState) {
      return;
    }

    // Set input from user state
    var hasAllClozesFilled = true;
    this.previousState.forEach(function (clozeContent, ccIndex) {

      // Register that an answer has been given
      if (clozeContent.length) {
        self.answered = true;
      }

      var cloze = self.clozes[ccIndex];
      cloze.setUserInput(clozeContent);

      // Handle instant feedback
      if (self.params.behaviour.autoCheck) {
        if (cloze.filledOut()) {
        console.log('cloze.checkAnswer')
          cloze.checkAnswer();
        }
        else {
          hasAllClozesFilled = false;
        }
      }
    });

    if (self.params.behaviour.autoCheck && hasAllClozesFilled) {
      self.showEvaluation();
      self.toggleButtonVisibility(STATE_CHECKING);
    }
  };

  /**
   * Disables any active input. Useful for freezing the task and dis-allowing
   * modification of wrong answers.
   */
  GuessIt.prototype.disableInput = function () {
    this.$questions.find('input').attr('disabled', true);
  };

  GuessIt.idCounter = 0;
  
  return GuessIt;
})(H5P.jQuery, H5P.Question);
