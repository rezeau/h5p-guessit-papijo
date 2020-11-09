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
    var self = this;
    var $wrapper;
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
      notEnoughRounds: "The solution won't be available before Round @round",
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
      scoreBarLabel: 'You got :num out of :total points',
      numWords: 'How many words do you want in your mystery sentence?',
      anyNumber: 'Any number',
      summary: 'Summary',
      sentencesGuessed: 'Sentences guessed',
      solutionsViewed: 'Solutions viewed',
      totalTimeSpent: 'Total Time Spent',
      totalRounds: 'Total Rounds',
      scoreExplanationButtonLabel: 'Show score explanation',
      scoreExplanationforSinglePoint: 'The maximum score for this activity is 1 and you got the point for any number of sentences guessed.',
      scoreExplanationforAllSentences: 'Score = number of guessed sentences / number of sentences in this activity.',
      scoreExplanationforSentencesWithNumberWords: 'Score = number of guessed sentences / number of sentences containing @words words.',
      userSentenceDescriptionLabel: 'Type a sentence to be guessed by your friends',
      userSentencenumRoundsLabel: 'Minimum number of rounds before Solutions can be displayed:',
      userSentenceTipLabel: 'Type a Tip for this sentence (optional)',
      userSentenceNeverShow: 'Never Show',
      behaviour: {        
        singlePoint: false,
        enableNumChoice: false,
        enableSolutionsButton: false,
        listGuessedSentences: false,
        sentencesOrder: 'normal',
        numRounds: 1,
        caseSensitive: false,        
      }
    }, params);
    
    // Delete empty questions. Should normally not happen, but... 
    // This check is needed if this GuessIt activity instance was saved with an empty item/sentence.     
    for (var i = this.params.questions.length - 1; i >= 0; i--) {
      if (!this.params.questions[i].sentence) {
        this.params.questions.length --;
      }
    }
    // JR added an ID field (needed for save state + numberchoice).
    for (i = 0; i < this.params.questions.length; i++) {
      this.params.questions[i]["ID"] = i;      
    }
    this.totalNumQuestions = this.params.questions.length; 
    if (this.params.playMode == 'userSentence') {
      this.totalNumQuestions = 1;
    }
    // Previous state
    this.contentData = contentData;                                                       
    if (this.contentData !== undefined && this.contentData.previousState !== undefined) {
      this.previousState = this.contentData.previousState;
    }
      
    // Clozes
    this.clozes = [];
    this.numQuestionsInWords = []
    this.sentencesFound = 0;
    this.sentencesGuessed = [];
    this.nbSentencesGuessed = 0;
    
    // Init userAnswers
    this.userAnswers = [];
    this.sentencesList = '';
    this.totalTimeSpent = 0;
    this.totalRounds = 0;
    this.solutionsViewed = [];
    this.nbSsolutionsViewed = 0;
    // Used by enableNumChoice 
    this.numWords = 0;
    this.numQuestions = 0;
    
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
    var self = this;
    this.$taskdescription = $('<div>', {
      'class': 'h5p-guessit h5p-guessit-description',
      'html': this.params.description
      })
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    $content.addClass ('h5p-guessit h5p-frame');
    
    // Special case of userSentence mode.
    if (this.params.playMode == 'userSentence') {
      this.$userSentenceDescription = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-usersentencedescription h5p-guessit-required',
          'html': self.params.userSentenceDescriptionLabel
          });
      this.$userTipDescription = $('<div>', {
          'class': 'h5p-guessit-usertipdescription',
          'html': self.params.userSentenceTipLabel
          });
      
      self.params.behaviour.enableNumChoice = false; 
      var usersentence = document.createElement('input');
      usersentence.setAttribute("type", "text");
      usersentence.setAttribute("id", "usersentence");          
      usersentence.setAttribute("class", "h5p-text-input-user");
      
      var usertip = document.createElement('input');
      usertip.setAttribute("type", "text");
      usertip.setAttribute("id", "usertip");          
      usertip.setAttribute("class", "h5p-text-input-user");
      
      this.$userSentenceDescription.prependTo($content);                      
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
      var $optionButtons = $('<div>', {
          'class': 'h5p-guessit-optionsbuttons',
          'html': '<div>' + this.params.userSentencenumRoundsLabel + '</div>'
        }).appendTo(this.$userSentence);
        
      var radios = ['2', '5', '10', '15', '20', this.params.userSentenceNeverShow];
      var i = 0;       
      for (var value of radios) {      
        user = 'userId-' + i;
        $optionButtons
          .append(`<input type="radio" id = "${user}" name="rounds" value="${value}">`)
          .append(`<label for="${value}">${value}</label></div>`);
         i++;            
      }
      $optionButtons.append('<br>');
      // Set the 'Never show' 'userId-5' radio button checked.      
      $("input[id = 'userId-5']").prop('checked',true);      
      
      var usersentenceok = H5P.JoubelUI.createButton({
          'class': 'h5p-guessit-okbutton',
          'title': 'OK',
          'html': 'OK'
        }).click(function () {          
          $usersentence = ($("#usersentence").val());
          $tip = ($("#usertip").val());            
          if ($usersentence !== '') {
            var numRnds = $("input[name='rounds']:checked").val();              
            if ( !$("input[id = 'userId-5']").is(':checked') ) {
              self.params.behaviour.enableSolutionsButton = true;
              self.params.behaviour.numRounds = numRnds;
            } else {
              self.params.behaviour.enableSolutionsButton = false;
            }
            self.registerDomElements($usersentence);
          } else { // User sentence is empty.
            // Empty potential value of usertip.
            $("#usertip").val(null)
            // Reset focus on input field
            $("#usersentence").focus(); 
          }  
        }).appendTo($optionButtons);

      if (sentence == undefined) {
        return;
      }
      $content.find('.h5p-guessit-usersentencedescription').addClass('h5p-guessit h5p-guessit-hide');
      self.params.questions[0].sentence = sentence;      
      self.params.questions[0].tip = $tip;
      self.params.questions.length = 1;
    }
    
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    var $containerParents = $content.parents('.h5p-container');

    self.numQuestions = self.params.questions.length;
    this.sentencesList = '';
    // Using instructions as label for our text groups
    const labelId = 'h5p-GuessIt-listGuessedSentences';
        
    // Register task content area
    self.setContent(self.createQuestions(labelId), {
    }); 
    
    // Init buttons for selecting number of words (if enabled in params.behaviour).
    if (this.params.behaviour.enableNumChoice) {
        
      // Put in array the number of words of all the questions
      var numWords = [];                          
      for (i = 0; i < this.params.questions.length; i++) {
        numWords[i] = this.sentenceClozeNumber[i];      
      }
      // https://stackoverflow.com/questions/5667888/counting-the-occurrences-frequency-of-array-elements
      var a = numWords;
      result = { };
      for(var i = 0; i < a.length; ++i) {
          if(!result[a[i]])
              result[a[i]] = 0;
          ++result[a[i]];
      } 
      
      var nbDifferentNums = Object.keys(result).length;
      // Do not ask user for nb words in sentences if there is no choice!
      if (nbDifferentNums > 1) {
        this.numQuestionsInWords = result;      
        this.$numberWords = $('<div>', {
          'class': 'h5p-guessit h5p-guessit-options',
          'html': this.params.numWords
        });
        
        var $optionButtons = $('<div>', {
          'class': 'h5p-guessit-optionsbuttons'
        }).appendTo(this.$numberWords);
        this.$numberWords.appendTo(this.$taskdescription);
        
        if (nbDifferentNums > 1) { 
        // Remove duplicates from numWords array 
        let uniquenumWords = [...new Set(numWords)];
        // Sort uniquenumWords array 
        uniquenumWords.sort();
        // Get last item from uniquenumWords array
        var limit = uniquenumWords.slice(-1).pop()
        // Init iteratation
        var numSentencesWithWords = [];
        
        uniquenumWords.forEach(iterateNW);      
        // Iterate uniquenumWords array 
        function iterateNW(item) {
          var n = self.numQuestionsInWords[item];
          numSentencesWithWords[item] = n;
          var s = self.params.sentence;
          if (n > 1) {
            s = self.params.sentences;
          }
          var setNumWords = H5P.JoubelUI.createButton({
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
        };
        n = self.params.questions.length;
        s = self.params.sentences;
        item = self.params.anyNumber
        setNumWords = H5P.JoubelUI.createButton({
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
      } else {                
        this.params.behaviour.enableNumChoice = false;
        self.numQuestions = self.params.questions.length;                    
        self.initTask();
      }
    } else {
      self.numQuestions = self.params.questions.length;                    
      self.initTask();
    } 
                            
    this.$taskdescription.prependTo($content);    
    
    if (self.params.behaviour.listGuessedSentences) {
      this.$divGuessedSentences = $('<div>', {
        'class': 'h5p-guessit-listGuessedSentences h5p-guessit-hide'
        }).appendTo(this.$taskdescription);
      // Retrieve potentially previously saved list.
      self.setH5PUserState();                                                     
      if (self.sentencesList !== '') {               
        self.$divGuessedSentences.removeClass ('h5p-guessit-hide');
        self.$divGuessedSentences.html(self.sentencesList)
      }
    }   
    
    // ... and buttons
    self.registerButtons();
    
    if (this.params.playMode == 'userSentence') {
      var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
      $content.find('.h5p-userSentence').addClass('h5p-guessit h5p-guessit-hide');
      var $container = $content.children('.h5p-container');
      var $userQuestion = $('<div>', {
        'class': 'h5p-question-content',
        'html': this.$questions
      }).prependTo($container);
    }
    
    // Sets focus on first input when starting game.
    $(document).ready(function() {
      self.$questions.eq(self.currentSentenceId).filter(':first').find('input:enabled:first').focus();      
    });
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
    
    // Check answer button
    self.addButton('check-answer', self.params.checkAnswer, function () {
      if (self.$timer == undefined) {
        self.initCounters();        
      }
      self.setFeedback();                             
      if (!self.allBlanksFilledOut()) {
        self.updateFeedbackContent(self.params.notFilledOut);
        // Sets focus on first empty blank input.
        $currentInputs = self.$questions.eq(self.currentSentenceId).find('input');
        $currentInputs.each(function(index, val){
          if ($(this).val() == '') {
            $(this).focus();
            return false; // breaks
          }
        });
          
      } else {
        self.toggleButtonVisibility(STATE_CHECKING);
        self.updateFeedbackContent('');
        self.markResults();
        self.timer.stop();       
        var isFinished = (self.getScore() === self.getMaxScore());
        if (isFinished) {
          var currentGuessedSentenceId = self.params.questions[self.currentSentenceId].ID
          self.sentencesGuessed.push(currentGuessedSentenceId);
          self.nbSentencesGuessed++;
          self.getCurrentState();
          if (self.sentencesFound  !== self.numQuestions - 1) {           
            self.showButton('new-sentence');
            setTimeout(function () {
              self.focusButton();
              }, 20);          
            self.showButton('end-game');          
          } else {
            // button end-game2 does not ask for confirmation
            setTimeout(function () {
              self.focusButton();
              }, 20);
            self.showButton('end-game2');
          }
          if (self.params.behaviour.listGuessedSentences) {
            self.sentencesList += '<p>' + self.params.questions[self.currentSentenceId].sentence + '</p>';
            self.$divGuessedSentences.removeClass ('h5p-guessit-hide');
            self.$divGuessedSentences.html(self.sentencesList)
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
    $newSentenceButton = self.addButton('new-sentence', self.params.newSentence, function () {
      self.newSentence();
      self.$questions.eq(self.currentSentenceId).filter(':first').find('input:enabled:first').focus();
    }, true);  
    this.hideButton('new-sentence');
    this.hideButton('end-game');
    
    // End game button  
    var isValidState = (this.previousState !== undefined 
      && Object.keys(this.previousState).length !== 0);
    
    self.addButton('end-game', self.params.endGame, function () {
      self.showFinalPage();
    }, true, {}, {           
        confirmationDialog: {                      
          enable: self.confirmEndGameEnabled,
          l10n: self.params.confirmEndGame,
          instance: self,
          $parentElement: $container
        }
      });  
    this.hideButton('end-game');
    
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
    this.currentSentenceClozes = [];
    this.allClozes = [];
    
    // Restore previous state (i.e. previsously guessed sentences).
    self.setH5PUserState(); 
    
    // Needed for random order (and numchoice)
    self.sentencesGuessed.sort();
    
    //https://stackoverflow.com/questions/9425009/remove-multiple-elements-from-array-in-javascript-jquery
    for (var i = self.sentencesGuessed.length -1; i >= 0; i--) {
      self.params.questions.splice(self.sentencesGuessed[i],1);
    }
    
    for(var i = 0; i < self.params.questions.length; i++) {
      this.currentSentenceClozes[i] = [];
    }
    
    
    var closeNumber = 0;
    for (var i = 0; i < self.params.questions.length; i++) {
      var sentenceClozeNumber = 0;
      
      // Remove extra blank spaces
      self.params.questions[i].sentence = self.params.questions[i].sentence.replace(/\s+/g,' ').trim();      
      
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
        // Array used by input Arial text
        self.allClozes.push([clozeNumber, sentenceClozeNumber, self.sentenceClozeNumber[i]]);        
        sentenceClozeNumber ++
        clozeNumber ++;        
        
        return cloze;
      });
      html += '<div class = "h5p-guessit-sentence h5p-guessit-sentence-hidden" id=role="group" aria-labelledby="' + labelId + '">' + question + '</div>';
    }
    
    self.hasClozes = clozeNumber > 0;
    this.$questions = $(html);
    
    // Set optional tip (for sentence)
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
      n = self.allClozes[i][1];
      t = self.allClozes[i][2];
      self.clozes[i].setInput($(this), '', function () {
      }, n, t);
    }).keydown(function (event) {
      var $this = $(this);
      
      // Needed to init timer & counter if enableNumChoice == false
      if (self.$timer == undefined) {
        self.initCounters();
      }
      
      // Adjust width of text input field to match value
      self.autoGrowTextField($this);

      var $inputs, isLastInput;
      var enterPressed = (event.keyCode === 13);
      var spacePressed = (event.keyCode === 32);
      
      if (enterPressed || spacePressed) {
        // Figure out which inputs are left to answer in current sentence.
        $inputs = self.$questions.eq(self.currentSentenceId).find('.h5p-input-wrapper:not(.h5p-correct) .h5p-text-input');
        // Figure out if this is the last input.
        isLastInput = $this.is($inputs[$inputs.length - 1]);
      }
      
      if ((isLastInput && !self.shiftPressed) || (enterPressed && isLastInput)) {
        // Focus first button on next tick        
        setTimeout(function () {
          self.focusButton();
        }, 10);
      }

      if (enterPressed || spacePressed) {
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
  
    var isFinished = (this.getScore() === this.getMaxScore());
    
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
    }
    else {
      this.hideButton('try-again');
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
      if (!this.minRoundsReached()) {
        var minRoundsText = this.params.notEnoughRounds
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
    var self = this;
    for (var i = 0; i < this.currentSentenceClozes[this.currentSentenceId].length; i++) {
      this.currentSentenceClozes[this.currentSentenceId][i].checkAnswer(this.defaultDiacriticsRemovalMap);
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
    
    if (this.solutionsViewed [this.currentSentenceId] !== true) {
      this.solutionsViewed [this.currentSentenceId] = true;
      this.nbSsolutionsViewed++;
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
    //this.removeFeedback();
    this.$questions.find('.h5p-input-wrapper').removeClass('h5p-wrong');
    this.enableInCorrectInputs();
    this.toggleButtonVisibility(STATE_ONGOING);
    this.resetGrowTextField();
    this.done = false;
    this.timer.play();
    this.counter.increment();
    
    // Clone sentence & feedback
    var $currentQuestion = this.$questions.eq(this.currentSentenceId) 
    $currentQuestion.clone(false).addClass('cloned').removeClass('has-tip').insertBefore(this.$questions.eq(this.currentSentenceId));
    var $clonedQuestion = $('[data-content-id="' + this.contentId + '"].h5p-content .cloned');
    $clonedQuestion.find('.h5p-input-wrapper > input').attr('disabled', true);
    $clonedQuestion.find('.joubel-tip-container').addClass('hidden');
  };

  /**
   * Display a new sentence to be guessed.
   * @public
   */
  GuessIt.prototype.newSentence = function () {    
    var self = this;
    this.sentencesFound ++;
    var $content = $('[data-content-id="' + this.contentId + '"].h5p-content');
    $content.find('.cloned').remove();
    var s = self.params.sentence + ' '; 
    // Capitalize initial letter
    s = s.charAt(0).toUpperCase() + s.slice(1); 
    self.$progress.text(s + (this.sentencesFound + 1) +'/' + this.numQuestions)
    self.initTask();    
  };

  GuessIt.prototype.initCounters = function () {
    var self = this; 
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content .h5p-question-content');
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
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
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
    // No point displaying progress in userSentence mode!
    if (this.params.playMode == 'availableSentences') {
      var s = self.params.sentence + ' ';
      s = s.charAt(0).toUpperCase() + s.slice(1);
      this.$progress = $('<div>', {
        class: 'counter-status',
        tabindex: -1,
        text: s + 1 +'/' + this.numQuestions
      });
      this.$progress.appendTo(this.$timer);
    }
    
  }

  GuessIt.prototype.initTask = function () {
    var self = this;
    var $content = $('[data-content-id="' + this.contentId + '"].h5p-content');                                                 
    $content.find('.h5p-container').removeClass('h5p-guessit-hide');
    
    // TODO move this trigger ?
    this.triggerXAPI('attempted');
    
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
    //this.removeFeedback();
    this.clearAnswers();
    this.removeMarkedResults();
    this.toggleButtonVisibility(STATE_ONGOING);
    this.resetGrowTextField();
    this.toggleAllInputs(true);
    this.done = false;
    
      // Hide current sentence and mark it as "used"
      this.$questions.eq(this.currentSentenceId).addClass('h5p-guessit-sentence-hidden used');    
      this.numQuestionsInWords[this.numWords] --
      var acceptedQuestions = [];
      
      if (this.params.behaviour.enableNumChoice) {      
        for (i = 0; i < this.params.questions.length; i++) {      
          if (this.sentenceClozeNumber[i] == this.numWords && !this.$questions.eq(i).hasClass('used')) {
            acceptedQuestions[i] = i;
          }
        }        
      } else {
        for (i = 0; i < this.numQuestions; i++) {
          if (!this.$questions.eq(i).hasClass('used')) {
            acceptedQuestions[i] = i;
          }
        }
      }
      
      // https://alligator.io/js/filter-array-method/
      acceptedQuestions = acceptedQuestions.filter(function(number) {
        return number !== null;
      });          
      if (this.params.playMode == 'userSentence') {
        acceptedQuestions = [0];
      }
      if (this.params.behaviour.sentencesOrder == 'normal')   {
        this.currentSentenceId = acceptedQuestions[0]
      } else { 
        // https://www.w3resource.com/javascript-exercises/javascript-array-exercise-35.php
        // Note ~~ equivalent of Math.floor See http://rocha.la/JavaScript-bitwise-operators-in-practice
        this.currentSentenceId = acceptedQuestions[~~(Math.random()*acceptedQuestions.length)]
      }
      this.$questions.eq(this.currentSentenceId).removeClass('h5p-guessit-sentence-hidden');
     
    if (this.params.playMode == 'userSentence') {
      this.currentSentenceId = 0; 
      this.$questions.eq(this.currentSentenceId).removeClass('h5p-guessit-sentence-hidden');
    }
    
  };
  
  GuessIt.prototype.showFinalPage = function () {    
    var self = this;                                                           
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');
    
    // Needed to display 'h5p-guessit-summary-screen' centered!
    $content.removeClass('h5p-no-frame');
    
    // Remove all these now useless elements from DOM.
    var $content = $('[data-content-id="' + self.contentId + '"].h5p-content');    
    
    
    $('.h5p-no-frame, .h5p-guessit-description, .h5p-question-introduction, .h5p-question-content,'
      +' .h5p-question-scorebar, .h5p-question-feedback',
      $content).hide();
      
    this.totalRounds += this.counter.getcurrent();
    
    // Calculate and nicely format total time spent.
    this.totalTimeSpent += this.timer.getTime();  
    var time = this.totalTimeSpent / 1000   
    // https://stackoverflow.com/questions/3733227/javascript-seconds-to-minutes-and-seconds#3733257
    function fancyTimeFormat(time) {   
      // Hours, minutes and seconds
      var hrs = ~~(time / 3600);
      var mins = ~~((time % 3600) / 60);
      var secs = ~~time % 60;
      var ret = "";
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
    var totalTime = fancyTimeFormat(time);
    
    // Calculate the number of sentences that have been guessed.
    var usedQuestions = 1;
    for (i = 0; i < this.params.questions.length; i++) {
      if (this.$questions.eq(i).hasClass('used')) {
        usedQuestions ++;
      }
    }  
      
    if (this.params.behaviour.singlePoint) {
      actualScore = 1;
      maxScore = 1;
      explainScore = this.params.scoreExplanationforSinglePoint; 
    } else {
      actualScore = this.nbSentencesGuessed;
      if (!this.params.behaviour.enableNumChoice) {
        maxScore = this.totalNumQuestions;
        explainScore = this.params.scoreExplanationforAllSentences;
      } else {           
        maxScore = this.numQuestions;
        explainScore = this.params.scoreExplanationforSentencesWithNumberWords
          .replace('@words', this.numWords);
      }
    }
    
    // Push score to XAPI 
    self.triggerXAPIScored(actualScore, maxScore, 'completed');
    self.triggerXAPI('answered');
                                                                                                        
    this.hideButton('end-game');
    this.hideButton('end-game2');
    this.hideButton('new-sentence');
    this.$timer.remove();
    $outof = '<td class="h5p-guessit-summary-table-row-category">' + this.params.sentencesGuessed + '</td>'
      + '<td class="h5p-guessit-summary-table-row-symbol h5p-guessit-check">&nbsp;</td>'
      + '<td class="h5p-guessit-summary-table-row-score">'
      + this.nbSentencesGuessed
      + '&nbsp;<span class="h5p-guessit-summary-table-row-score-divider">/</span>&nbsp;'
      + maxScore + '</td></tr>';
    if (this.params.playMode == 'userSentence') {
        $outof = '';
    }
    var text = '<div class="h5p-guessit-summary-header">'
      + this.params.summary + '</div>'
      + '<table class="h5p-guessit-summary-table">'
      + $outof
      + '<tr><td class="h5p-guessit-summary-table-row-category">' + this.params.totalRounds + '</td>'
      + '<td class="h5p-guessit-summary-table-row-symbol"></td>'
      + '<td class="h5p-guessit-summary-table-row-score">' + this.totalRounds + '</td></tr>'
      
      + '<tr><td class="h5p-guessit-summary-table-row-category">' + this.params.solutionsViewed + '</td>'
      + '<td class="h5p-guessit-summary-table-row-symbol"></td>'
      + '<td class="h5p-guessit-summary-table-row-score">' + this.nbSsolutionsViewed + '</td></tr>'
      
      + '<tr><td colspan="3" class="h5p-guessit-summary-table-row-category">' 
      + this.params.totalTimeSpent + '<span style = "float: right;">' + totalTime +  '</span></td>'
      + '<td class="">' + '</td>'
      + '<td class="">' + '</td></tr>'        
      + '</table>';
      
    var $content = $('[data-content-id="' + self.contentId + '"] .h5p-container');
    
    var $feedback = $('<div>', {
      'class': 'h5p-guessit-summary-screen',
      'html': text
    }).appendTo($content);
    
    if (this.$divGuessedSentences) {
      this.$divGuessedSentences.prependTo($feedback)
    }
    
    this.$feedbackContainer = $('<div class="h5p-guessit feedback-container"/>')
      .appendTo($feedback);
    if (this.params.playMode == 'availableSentences') {
      scoreBarLabel = this.params.scoreBarLabel.replace('@score', actualScore).replace('@total', maxScore);
      scoreBar = H5P.JoubelUI.createScoreBar(maxScore, scoreBarLabel, explainScore, this.params.scoreExplanationButtonLabel);
      scoreBar.setMaxScore(maxScore);
      scoreBar.setScore(actualScore);
      scoreBar.appendTo(this.$feedbackContainer);
    }
    this.trigger('resize');
    
    // Reset all user state elements.
    if (usedQuestions == this.params.questions.length) {
        this.sentencesList = '';
        this.sentencesGuessed.length = 0;
        this.nbSentencesGuessed = 0;
        this.totalRounds = 0;
        this.nbSsolutionsViewed = 0;
        this.totalTimeSpent = 0;
        self.getCurrentState();              
    }
    
    // Display reset button to enable user to do the task again.
    
    var $resetTaskButton = H5P.JoubelUI.createButton({
        'class': 'h5p-guessit-retry-button',
        'title': self.params.tryAgain,
        'html': self.params.tryAgain
      }).click(function () {         
        var url = window.location.href; 
        window.top.location.href = url;       
      }).appendTo(this.$feedbackContainer);
    
  }
  
  /**
   * Hides all buttons.
   * @public
   */
  GuessIt.prototype.hideButtons = function () {
  
    this.toggleButtonVisibility(STATE_FINISHED);
    
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
    var state = {};
    state.sentencesList = this.sentencesList;
    state.sentencesGuessed = this.sentencesGuessed;
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
    var self = this;
    var isValidState = (this.previousState !== undefined 
      && Object.keys(this.previousState).length !== 0);
    
    // Check that stored user state is valid
    if (!isValidState) {
      return;
    } 
    this.sentencesList = this.previousState.sentencesList;
    this.sentencesGuessed = this.previousState.sentencesGuessed;
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

  GuessIt.prototype.eventCompleted = function () {
   // Create and trigger xAPI event 'completed'
    var completedEvent = this.createXAPIEventTemplate('completed');
    completedEvent.setScoredResult(1, 1, self, true, true);
    completedEvent.data.statement.result.duration = 'PT' + (Math.round(this.timer.getTime() / 10) / 100) + 'S';
    this.trigger(completedEvent);
  }

  GuessIt.idCounter = 0;

  return GuessIt;
})(H5P.jQuery, H5P.Question);
