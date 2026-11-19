"use client";

import QuizRender from "@/app/components/quiz/quizRender";
import {
  getQuizCodeLanguage,
  parseQuizQuestion,
  QuizQuestionCodeBlocks,
  QuizQuestionPrompt,
} from "@/app/components/quiz/InlineCodeText";
import type { AnswerValue, QuizData } from "@/app/quiz/types";

interface QuizQuestionViewProps {
  quiz?: QuizData;
  currentIndex: number;
  activeQuizIndex: number;
  value: AnswerValue;
  onChange: (nextValue: AnswerValue) => void;
  disabled: boolean;
  onPairMatched: () => void;
  onIncorrectPair: () => void;
}

export default function QuizQuestionView({
  quiz,
  currentIndex,
  activeQuizIndex,
  value,
  onChange,
  disabled,
  onPairMatched,
  onIncorrectPair,
}: QuizQuestionViewProps) {
  const questionParts = parseQuizQuestion(
    quiz?.question_text ?? "Loading question...",
  );
  const questionHasCode = questionParts.some((part) => part.type === "code");

  const renderedQuestion = quiz ? (
    <QuizRender
      quiz={quiz}
      value={value}
      onChange={onChange}
      disabled={disabled}
      shuffleChoices={activeQuizIndex !== 0}
      onPairMatched={onPairMatched}
      onIncorrectPair={onIncorrectPair}
    />
  ) : null;

  return (
    <div
      className={`quiz-container${questionHasCode ? " has-code-block" : ""}`}
      key={`${quiz?.quiz_id ?? "quiz"}-${currentIndex}`}
    >
      <QuizQuestionPrompt parts={questionParts} />
      {questionHasCode ? (
        <div className="quiz-question-layout">
          <div className="quiz-question-code-column">
            <QuizQuestionCodeBlocks
              parts={questionParts}
              codeLanguage={getQuizCodeLanguage(quiz?.cat_id, quiz?.cat_name)}
            />
          </div>
          <div className="quiz-question-answer-column">{renderedQuestion}</div>
        </div>
      ) : (
        renderedQuestion
      )}
    </div>
  );
}
