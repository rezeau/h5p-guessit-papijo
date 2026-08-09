# Test Plan

## Fixed in 1.8.2: Moodle core Continue state

### Historical Confirmed Behavior

- In Moodle core H5P, Save Content State works for normal activity
  leave-and-return behavior.
- In Moodle core H5P, View Summary → OK → Continue game resets the activity.
- The defect is present in H5P.GuessIt 1.6, 1.7, and 1.8.
- The third-party Moodle H5P plugin does not exhibit the problem.

### Diagnosis

- GuessIt's Continue game action executed `window.top.location.reload()`.
- Moodle core state persistence could not reliably complete before that
  immediate reload.
- The portable fix continues the game in place instead of reloading the host
  page.
- Host-specific persistence APIs should not be the primary solution.

### Release Status and Verification

- Fixed and tested for H5P.GuessIt 1.8.2.
- Automated Continue lifecycle regression coverage passes for configured
  sentence and Wordle modes.
- Manual verification passed in H5P CLI, WordPress, Moodle core H5P, and the
  Moodle third-party H5P plugin.
