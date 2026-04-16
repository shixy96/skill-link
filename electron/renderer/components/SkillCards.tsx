import React, { useEffect, useState } from 'react';
import type { Skill } from '../../types.js';

interface SkillCardsProps {
  onSelectSkill: (skill: Skill | null) => void;
  selectedSkill: Skill | null;
  refreshKey: number;
  onCreateLink: (skillRef: string, skill?: Skill) => void;
}

export function SkillCards({ onSelectSkill, selectedSkill, refreshKey, onCreateLink }: SkillCardsProps) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadSkills();
  }, [refreshKey]);

  async function loadSkills() {
    setLoading(true);
    setError(null);
    try {
      const nextSkills = await window.skilllink?.skillList();
      setSkills(nextSkills ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load skills.');
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="empty-state">Loading skills...</div>;
  }

  if (error) {
    return <div className="empty-state">{error}</div>;
  }

  if (skills.length === 0) {
    return (
      <div className="empty-state">
        No skills discovered yet.
      </div>
    );
  }

  return (
    <div className="skills-grid">
      {skills.map((skill) => {
        const activeSymlinks = skill.symlinks.filter(s => s.status === 'active').length;
        const brokenSymlinks = skill.symlinks.filter(s => s.status === 'broken').length;

        return (
          <article
            key={skill.id}
            className={`skill-card ${selectedSkill?.id === skill.id ? 'is-selected' : ''}`}
          >
            <button onClick={() => onSelectSkill(skill)}>
              <div className="skill-title">{skill.name}</div>
              <div className="muted">{skill.repo}</div>
              <div className="path-text" title={skill.path}>{skill.path}</div>
            </button>

            <div className="badge-row">
              <span className="badge">{activeSymlinks} active</span>
              {brokenSymlinks > 0 && (
                <span className="badge badge-danger">{brokenSymlinks} broken</span>
              )}
            </div>

            <div className="card-actions">
              <button onClick={() => onCreateLink(skill.id, skill)}>Create Link</button>
              <button onClick={() => onSelectSkill(skill)}>Manage</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
