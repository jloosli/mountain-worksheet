# Input: `gh pr checks <n> --json name,bucket,link`.
# Argument: $mode, either "state" or "render".
#   state  -> "none" (no checks reported yet), "pending", "fail" or "pass"
#   render -> one "<bucket>  <name>" line per check; failures add their link
#
# Buckets are gh's own: pass, fail, pending, skipping, cancel. A cancelled
# check counts as a failure: CI did not pass.

if $mode == "state" then
  if length == 0 then "none"
  elif any(.[]; .bucket == "pending") then "pending"
  elif any(.[]; .bucket == "fail" or .bucket == "cancel") then "fail"
  else "pass"
  end
else
  sort_by(.name)[]
  | "\(.bucket)\t\(.name)"
    + (if .bucket == "fail" or .bucket == "cancel" then "\t\(.link)" else "" end)
end
