# Input: the REST array from GET /repos/{o}/{r}/pulls/{n}/reviews (slurped and
# flattened across pages). Argument: $head, the PR's head commit SHA.
# Output: Copilot's latest review of $head as readable text, or nothing when
# Copilot has not reviewed that commit yet.
#
# Copilot's review body is HTML-heavy: severity badges are <picture> elements,
# file paths carry zero-width spaces, and a "What changed in this PR" table
# repeats the diff. Badges become their alt text ("[Medium severity]"), links
# to review threads become the thread's comment id, and everything else that
# is markup is dropped.

def clean_body:
  gsub("<details>\\s*<summary><strong>What changed in this PR</strong></summary>[\\s\\S]*?</details>"; "")
  | gsub("<!--[\\s\\S]*?-->"; "")
  | gsub("<picture>[\\s\\S]*?alt=\"(?<alt>[^\"]*)\"[\\s\\S]*?</picture>"; "[\(.alt)]")
  | gsub("\\[(?<t>[^\\]]*)\\]\\(https://github\\.com/[^)]*#discussion_r(?<id>\\d+)\\)"; "\(.t) [\(.id)]")
  | gsub("<sub>Review effort[^<]*</sub>"; "")
  | gsub("<[^>]+>"; "")
  | gsub("​"; "")
  | gsub("[ \t]+\n"; "\n")
  | gsub("\n{3,}"; "\n\n")
  | ltrimstr("\n") | rtrimstr("\n")
  | gsub("^\\s+|\\s+$"; "");

[ .[]
  | select(.user.login == "copilot-pull-request-reviewer[bot]")
  | select(.commit_id == $head) ]
| sort_by(.submitted_at)
| last
| select(. != null)
| "Copilot review of \(.commit_id[0:7]) (\(.state), \(.submitted_at)):\n\n\(.body | clean_body)"
