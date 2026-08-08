# Test Plan

## Deferred: Moodle core Continue state

### Confirmed Behavior

- In Moodle core H5P, Save Content State works for normal activity
  leave-and-return behavior.
- In Moodle core H5P, View Summary → OK → Continue game resets the activity.
- The defect is present in H5P.GuessIt 1.6, 1.7, and 1.8.
- The third-party Moodle H5P plugin does not exhibit the problem.

### Diagnosis

- GuessIt's Continue game action executes `window.top.location.reload()`.
- Moodle core state persistence may not complete before that immediate reload.
- A future portable fix should continue the game in place instead of reloading
  the host page.
- Host-specific persistence APIs should not be the primary solution.

### Release Status and Follow-up

- This issue does not block H5P.GuessIt 1.8.1.
- Future branch: `fix/moodle-core-continue-state`.
- Likely future patch, if the fix proves backward-compatible:
  H5P.GuessIt 1.8.2.
