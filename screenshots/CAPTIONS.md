# Launcher menu — screenshots

iPhone-sized viewport (390×844 CSS px, 2× device pixels), Collie `v0.32.0+7b87018`, a real herdr
session, and this `launchers.toml`:

```toml
[[launchers]]
command = "rumen-peek"
label = "Runs & quota"

[[launchers]]
command = "showy-quota-peek"
label = "Quota bars"

[[launchers]]
command = "lazygit"
label = "Git"
cwd = "~/@dev/+forks/collie"
```

| File | Caption for the PR |
| --- | --- |
| `1-dashboard-launch-section.png` | The **Launch** section on the dashboard, between the herd and the Spaces navigator: one tap per row. |
| `2-dashboard-launch-folded.png` | It folds like Spaces and Recent, keeping its count — the one dashboard section whose height a config file decides. |
| `3-launch-sheet.png` | The same rows behind the 🚀 in the Space and pane headers. A sheet row is a full screen width, so it shows the command under the label. |
| `4-pane-header-rocket.png` | The pane header at 390 px: Find, 🚀, status badge. No overflow; the trigger is sized to that cluster, not the roomier header gear. |
| `5-peek-running.png` | One tap later: a new Space labelled from the row, with the command already typed and run. |
| `6-space-exists-while-running.png` | While it runs it is an ordinary Space — `SPACES (7)`, `Quota bars · just now` at the top of the list. |
| `7-space-gone-after-quit.png` | After quitting the command: `SPACES (6)`, and the row is gone. Herdr drops a Space whose last pane closes, so a self-closing command leaves nothing to tidy up. |

Suggested pairs: 1 + 2 for the fold, 3 + 5 for the sheet-to-result path, 6 + 7 for the lifecycle
claim (that pair is the whole argument for a self-closing pane, and it is the one thing prose cannot
show).
