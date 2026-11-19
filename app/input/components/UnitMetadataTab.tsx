"use client";

import type { Category } from "@/app/actions/quiz";
import type { SectionOption } from "../types";

interface UnitMetadataTabProps {
  unitTitle: string;
  onUnitTitleChange: (title: string) => void;
  selectedCatId: string;
  onCategoryChange: (catId: string) => void;
  selectedSecId: string;
  onSectionChange: (secId: string) => void;
  selectedUnit: string;
  onUnitOrderChange: (unitOrder: string) => void;
  categories: Category[];
  sections: SectionOption[];
}

export default function UnitMetadataTab({
  unitTitle,
  onUnitTitleChange,
  selectedCatId,
  onCategoryChange,
  selectedSecId,
  onSectionChange,
  selectedUnit,
  onUnitOrderChange,
  categories,
  sections,
}: UnitMetadataTabProps) {
  const handleCategorySelect = (nextCatId: string) => {
    onCategoryChange(nextCatId);
    const current = sections.find((s) => s.sec_id.toString() === selectedSecId);
    if (current?.cat_id != null && current.cat_id.toString() !== nextCatId) {
      onSectionChange("");
    }
  };

  const visibleSections = sections.filter(
    (s) =>
      !selectedCatId || s.cat_id == null || s.cat_id.toString() === selectedCatId,
  );

  return (
    <div className="unit-form-fields">
      <div className="form-group">
        <label htmlFor="unit_title">Unit Title</label>
        <input
          id="unit_title"
          name="unit_title"
          type="text"
          className="form-input"
          placeholder="Enter the unit title..."
          value={unitTitle}
          onChange={(event) => onUnitTitleChange(event.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="cat_id">Category</label>
        <select
          id="cat_id"
          name="cat_id"
          className="form-select"
          required
          value={selectedCatId}
          onChange={(e) => handleCategorySelect(e.target.value)}
        >
          <option value="" disabled>
            Select Category
          </option>
          {categories.map((cat) => (
            <option key={cat.cat_id} value={cat.cat_id.toString()}>
              {cat.cat_name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div className="form-group">
          <label htmlFor="sec_id">Section</label>
          <select
            id="sec_id"
            name="sec_id"
            className="form-select"
            required
            value={selectedSecId}
            onChange={(e) => onSectionChange(e.target.value)}
          >
            <option value="" disabled>
              Select Section
            </option>
            {visibleSections.map((section) => (
              <option key={section.sec_id} value={section.sec_id.toString()}>
                {section.sec_num}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="unit_order">Unit</label>
          <select
            id="unit_order"
            name="unit_order"
            className="form-select"
            required
            value={selectedUnit}
            onChange={(e) => onUnitOrderChange(e.target.value)}
          >
            <option value="" disabled>
              Select Unit
            </option>
            {[1, 2, 3].map((unitNumber) => (
              <option key={unitNumber} value={unitNumber.toString()}>
                {unitNumber}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
