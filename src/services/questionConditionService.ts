function evaluateDisplayLogic(question, answers): boolean {
  const groupResults = question.conditionGroups.map(group => {
    const triggerAnswer = answers[group.triggerQuestionId];
    return group.conditions.some(cond =>   // OR within a group
      evaluators[cond.conditionType](triggerAnswer, cond.conditionMatch)
    );
  });

  const groupsMatch = question.displayLogicMatchType === 'ALL'
    ? groupResults.every(Boolean)
    : groupResults.some(Boolean);          // ANY

  return question.displayLogicAction === 'HIDE_QUESTION' ? !groupsMatch : groupsMatch;
}

const evaluators: Record<string, (answer: any, match: any) => boolean> = {
  HAS_ANSWER: (a) => a != null && a !== '',
  EQUAL: (a, m) => a === m,
  DOES_NOT_EQUAL: (a, m) => a !== m,
  INCLUDES: (a, m) => Array.isArray(a) && a.includes(m),
  // future operators added here without touching existing ones
};