export const bannedPublicTerms=/\b(?:fuck(?:ing)?|shit|wtf|damn|virtual|editorial|diagnostics?|engine|TypeError|ReferenceError|SyntaxError|SQLITE_ERROR|D1_ERROR|Wrangler|JWT|CSRF|WebSocket)\b|stack trace|internal server error|cannot read propert|unexpected token/i;
export const technicalFailure=/\b(?:TypeError|ReferenceError|SyntaxError|SQLITE_ERROR|D1_ERROR|PostgreSQL|Wrangler|JWT|CSRF|WebSocket)\b|stack trace|internal server error|cannot read propert|unexpected token|failed to fetch|networkerror/i;
export function publicErrorMessage(value,fallback="Something went wrong. Please try again.") {
 const message=typeof value==="string"?value:typeof value?.message==="string"?value.message:"";
 return !message||message.length>500||bannedPublicTerms.test(message)?fallback:message;
}
export function publicNotice(value) {
 const message=String(value||"");
 return technicalFailure.test(message)?"Something went wrong. Please try again.":message;
}
