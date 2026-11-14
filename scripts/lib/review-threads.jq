# Input: the GraphQL responses for pullRequest.reviewThreads, one per page, as
# `gh api graphql --paginate --slurp` gives them (see await-review.sh for the
# query). A single response object works too.
# Output: every unresolved thread, one block each:
#
#   [<comment id>] <path>:<line> [(outdated)] [(replied by <login>)]
#     <first comment body, indented>
#
# The comment id is the thread's first comment's REST id: reply with
#   gh api repos/{o}/{r}/pulls/{n}/comments/<id>/replies -f body=...
# A thread whose last comment is not by the thread's author has been replied
# to; its body is cut to one line so the threads still awaiting a reply stand
# out.

def indent: split("\n") | map("    " + .) | join("\n");

[ (if type == "array" then .[] else . end)
  | .data.repository.pullRequest.reviewThreads.nodes[]
  | select(.isResolved | not) ] as $open
| "Unresolved review threads: \($open | length)",
  ( $open[]
    | .comments.nodes as $c
    | ($c[0]) as $first
    | ($c[-1].author.login) as $last
    | ($last != $first.author.login) as $replied
    | "[\($first.databaseId)] \(.path):\(.line // .originalLine // "?")"
      + (if .isOutdated then " (outdated)" else "" end)
      + (if $replied then " (replied by \($last))" else "" end)
      + "\n"
      + (if $replied
         then ($first.body | split("\n")[0] | .[0:160]) | indent
         else $first.body | gsub("\u200b"; "") | rtrimstr("\n") | indent
         end) )
