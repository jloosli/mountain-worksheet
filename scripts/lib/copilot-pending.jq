# Input: the REST array from GET /repos/{o}/{r}/issues/{n}/timeline (slurped
# and flattened across pages).
# Output: "pending" when Copilot has an outstanding review request, else "idle".
#
# The PR's reviewRequests field often reads [] even right after Copilot was
# requested, so it can't be trusted. The timeline can: a request is
# outstanding when Copilot's latest review_requested event is newer than its
# latest review and was not removed since. ISO-8601 UTC timestamps compare
# correctly as strings.

def latest(f): [ .[] | f ] | max // "";

latest(select(.event == "review_requested" and .requested_reviewer.login == "Copilot") | .created_at) as $requested
| latest(select(.event == "review_request_removed" and .requested_reviewer.login == "Copilot") | .created_at) as $removed
| latest(select(.event == "reviewed" and .user.login == "Copilot") | .submitted_at) as $reviewed
| if $requested != "" and $requested > $reviewed and $requested > $removed
  then "pending"
  else "idle"
  end
