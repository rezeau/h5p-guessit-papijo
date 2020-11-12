(function ($, GuessIt) {

  /**
   * Simple private class for keeping track of clozes.
   *
   * @class H5P.GuessIt.Cloze
   * @param {string} answer
   * @param {Object} behaviour Behavioral settings for the task from semantics
   * @param {boolean} behaviour.acceptSpellingErrors - If true, answers will also count correct if they contain small spelling errors.
   * @param {Object} l10n Localized texts
   * @param {string} l10n.solutionLabel Assistive technology label for cloze solution
   * @param {string} l10n.inputLabel Assistive technology label for cloze input
   */
  GuessIt.Cloze = function (solution, behaviour, defaultUserAnswer, l10n) {
    var self = this;
    var $input, $wrapper;
    var answers = solution.solutions;
    var answer = answers.join('/');   
    var checkedAnswer = null;
    var inputLabel = l10n.inputLabel;
    
    if (behaviour.caseSensitive !== true) {
      // Convert possible solutions into lowercase
      answer = answer.toLowerCase();
    }

    /**
     * Check if the answer is correct.
     *
     * @private
     * @param {string} answered
     */                               
    var correct = function (answered) {
      if (behaviour.caseSensitive !== true) {
        answered = answered.toLowerCase();
      }                                
      return (answered == answer);
    };                                

    /**
     * Check if filled out.
     *
     * @param {boolean}
     */
    this.filledOut = function () {
      var answered = this.getUserAnswer();
      // Blank can be correct and is interpreted as filled out.
      return (answered !== '' || correct(answered));
    };

    /**
     * Check the cloze and mark it as wrong or correct.
     */
    this.checkAnswer = function () {
      // Remove potentially existing markup element.
      $( '.h5p-guessit-markup', $wrapper ).remove();
      
      checkedAnswer = this.getUserAnswer();
      var isCorrect = correct(checkedAnswer);
      if (isCorrect) {
        $wrapper.addClass('h5p-correct');
        $input.attr('disabled', true)
          .attr('aria-label', inputLabel + '. ' + l10n.answeredCorrectly);
      }
      else {                                       
        if (checkedAnswer) {
          this.markUp(checkedAnswer);
        }
        $wrapper.addClass('h5p-wrong');
        $input.attr('aria-label', inputLabel + '. ' + l10n.answeredIncorrectly);        
      }
    };
    
    /**
     * Check the cloze and mark it as wrong or correct.
     */
    this.checkCorrect = function () {
      checkedAnswer = this.getUserAnswer();
      var isCorrect = correct(checkedAnswer);
      return isCorrect;      
    };

    /**
     * Disables input.
     * @method disableInput
     */
    this.disableInput = function () {
      this.toggleInput(false);
    };

    /**
     * Enables input.
     * @method enableInput
     */
    this.enableInput = function () {
      this.toggleInput(true);
    };

    /**
     * Toggles input enable/disable
     * @method toggleInput
     * @param  {boolean}   enabled True if input should be enabled, otherwise false
     */
    this.toggleInput = function (enabled) {
      $input.attr('disabled', !enabled);
    };
    /**
     * Show the correct solution.
     */
    this.showSolution = function () {
      if (correct(this.getUserAnswer())) {
        return; // Only for the wrong ones
      }

      $('<span>', {
        'aria-hidden': true,
        'class': 'h5p-correct-answer',
        text: answer,
        insertAfter: $wrapper
      });
      $input.attr('disabled', true);
      var ariaLabel = inputLabel + '. ' +
        l10n.solutionLabel + ' ' + answer + '. ' +
        l10n.answeredIncorrectly;

      $input.attr('aria-label', ariaLabel);
    };


    /**
     * Mark up the incorrect studentAnswer.
     */
    this.markUp = function (studentAnswer) {
      var cleanAnswer = answer; 
      var hasOnlyAscii = /^[\u0000-\u007f]*$/.test(answer);
      if (!hasOnlyAscii) {
        cleanAnswer = this.removeDiacritics (answer);
      }
      var cleanStudentAnswer = studentAnswer;
      hasOnlyAscii = /^[\u0000-\u007f]*$/.test(studentAnswer);
      if (!hasOnlyAscii) {
        cleanStudentAnswer = this.removeDiacritics (studentAnswer);
      }
      
      var markup = '';
      var eq = '=';
      var lw = '<';
      var gt = '>';
      
      // TODO offer this in the parameters?
      // List of punctuation or weird characters (other than those in the diactitics list below) to "give" to the user.
      const punctuation = "';:,.-?¿!¡ßœ"
      var minLen = Math.min(answer.length, studentAnswer.length);      
      for (i = 0; i < minLen; i++) {
        answerLetter = answer[i];
        cleanAnswerLetter = cleanAnswer[i].toLowerCase();
        studentLetter = studentAnswer[i];
        cleanStudentLetter = cleanStudentAnswer[i].toLowerCase();   
          
        if (studentLetter == answerLetter) {
          markup += eq;
        } else if (cleanStudentLetter == cleanAnswerLetter ) {
          markup += answerLetter;
          break;
        } else if (cleanStudentLetter == cleanAnswerLetter || punctuation.includes(cleanAnswer[i]) ) {
          markup += answerLetter;
          break;           
        } else if (
            cleanStudentLetter < cleanAnswerLetter
          ) {
          markup += gt;
          break;
        } else {
          markup += lw;
          break;
        }
      }        
      
      // Automatically give punctuation at end of sentence if absent.
      if (studentAnswer.length == answer.length - 1  
          && cleanStudentAnswer[i] === undefined 
          && punctuation.includes(cleanAnswer[i]) ) 
      {
        markup += cleanAnswer[i];
      }
      
      // Place the markup line below the studentAnswer by 18px.
      var offset = $wrapper.offset();
      offset.top = 22;
      offset.left = 0;      
      $('<span>', {
        'aria-hidden': true,
        'class': 'h5p-guessit-markup',
        'offset': offset,
        text: markup,
        appendTo: $wrapper
      });                             
      $input.attr('disabled', true);
      var ariaLabel = inputLabel + '. ' +
        l10n.solutionLabel + ' ' + answer + '. ' +
        l10n.answeredIncorrectly;

      $input.attr('aria-label', ariaLabel);
    };

    /**
     * @returns {boolean}
     */
    this.correct = function () {
      return correct(this.getUserAnswer());
    };

    /**
     * Set input element.
     *
     * @param {H5P.jQuery} $element
     * @param {function} afterCheck
     * @param {function} afterFocus
     * @param {number} clozeIndex Index of cloze
     * @param {number} totalCloze Total amount of clozes in blanks
     */
    this.setInput = function ($element, afterCheck, afterFocus, clozeIndex, totalCloze) {
      $input = $element;
      $wrapper = $element.parent();
      inputLabel = inputLabel.replace('@num', (clozeIndex + 1))
        .replace('@total', totalCloze);
        
      $input.attr('aria-label', inputLabel);
      
      $input.keyup(function () {
        if (checkedAnswer !== null && checkedAnswer !== self.getUserAnswer()) {
          // The Answer has changed since last check
          checkedAnswer = null;
          $wrapper.removeClass('h5p-wrong');
          $input.attr('aria-label', inputLabel);
          if (afterFocus !== undefined) {
            afterFocus();
          }
        }
      });
    };

    /**
     * @returns {string} Cloze html
     */
    this.toString = function () {
      var result = '<span class="h5p-input-wrapper"><input type="text" class="h5p-text-input" autocomplete="off" autocapitalize="off"></span>';
      self.length = result.length;
      return result;
    };

    /**
     * @returns {string} Trimmed answer
     */
    this.getUserAnswer = function () {
      return H5P.trim($input.val());
    };

    /**
     * @returns {string} Answer
     */
    this.getUserInput = function () {
      return $input.val();
    };

    /**
     * @param {string} text New input text
     */
    this.setUserInput = function (text) {
      $input.val(text);
    };

    /**
     * Resets aria label of input field
     */
    this.resetAriaLabel = function () {
      $input.attr('aria-label', inputLabel);
    };
    
    this.removeDiacritics = function (str) {
    
    // IMPORTANT: this js file must be encoded in UTF-8 no BOM(65001)
    // If it's not, then use the unicode codes at https://web.archive.org/web/20120918093154/http://lehelk.com/2011/05/06/script-to-remove-diacritics/ 
      var defaultDiacriticsRemovalMap = [
        // Latin European languages diacritics
        {'base':'a', 'letters':/[àáâãäåæ]/g},
        {'base':'c', 'letters':/[ç]/g},
        {'base':'e', 'letters':/[éèêë]/g},
        {'base':'i', 'letters':/[ìíîï]/g},
        {'base':'n', 'letters':/[ñ]/g},
        {'base':'o', 'letters':/[òóôõöø]/g},
        {'base':'u', 'letters':/[ùúûü]/g},
        {'base':'y', 'letters':/[ýÿ]/g},
      ];

      var changes = defaultDiacriticsRemovalMap;
      for(var i = 0; i < changes.length; i++) {
          str = str.replace(changes[i].letters, changes[i].base);
      }
      return str;
    };
  };

})(H5P.jQuery, H5P.GuessIt);
