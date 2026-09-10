"use client";

import React from "react";

interface FitbEditorProps {
  defaultValue?: string;
}

export const FitbEditor: React.FC<FitbEditorProps> = ({ defaultValue = "" }) => {
  return (
    <div className="form-group">
      <label htmlFor="fitb_answer">Correct Blank Answer</label>
      <input
        type="text"
        id="fitb_answer"
        name="fitb_answer"
        placeholder="Enter the correct answer word(s)..."
        className="form-input"
        defaultValue={defaultValue}
        required
      />
    </div>
  );
};
