import { useState } from 'react';

interface Project {
  name: string;
  repo?: string;
  description: string;
  goals?: string[];
  status: 'TBD' | 'WIP' | 'Done';
  category?: string;
}

interface CategoryData {
  category: string;
  projects: Project[];
}

export default function ProjectsTable({ categories }: { categories: CategoryData[] }) {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Flatten all projects
  const allProjects = categories.flatMap(cat =>
    cat.projects.map(p => ({ ...p, category: cat.category }))
  );

  // Sort by category, then by status
  const statusOrder = { Done: 0, WIP: 1, TBD: 2 };
  const sortedProjects = allProjects.sort((a, b) => {
    const catOrder = categories.findIndex(c => c.category === a.category) -
                     categories.findIndex(c => c.category === b.category);
    if (catOrder !== 0) return catOrder;
    return statusOrder[a.status] - statusOrder[b.status];
  });

  // Calculate rowspan for each category row
  const getCategoryRowspan = (index: number) => {
    const currentCategory = sortedProjects[index].category;
    let rowspan = 1;
    for (let i = index + 1; i < sortedProjects.length; i++) {
      if (sortedProjects[i].category === currentCategory) {
        rowspan++;
      } else {
        break;
      }
    }
    return rowspan;
  };

  // Check if category cell should be shown (first in group)
  const showCategoryCell = (index: number) => {
    if (index === 0) return true;
    return sortedProjects[index].category !== sortedProjects[index - 1].category;
  };

  const getCategoryClass = (category: string) => {
    const map: { [key: string]: string } = {
      'Silicon': 'silicon',
      'Virt': 'virt',
      'Compiler': 'compiler',
      'Framework': 'framework',
      'Agent': 'agent'
    };
    return map[category] || 'default';
  };

  return (
    <div className="container">
      {/* Projects Table */}
      <div className="table-wrapper">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Project</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {sortedProjects.map((project, idx) => {
              const catClass = getCategoryClass(project.category || '');
              const showCat = showCategoryCell(idx);
              const rowspan = showCat ? getCategoryRowspan(idx) : undefined;

              return (
                <tr
                  key={idx}
                  className={`category-${catClass} ${selectedProject === project ? 'selected' : ''}`}
                  onClick={() => setSelectedProject(selectedProject === project ? null : project)}
                >
                  {showCat && (
                    <td className="category-cell" rowSpan={rowspan}>
                      <span className="category-badge">{project.category}</span>
                    </td>
                  )}
                  <td className="project-cell">
                    <span className="project-name">{project.name}</span>
                    {project.repo && (
                      <a
                        href={`https://github.com/lastweek/${project.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="github-link"
                        onClick={(e) => e.stopPropagation()}
                        aria-label="View on GitHub"
                      >
                        <svg width={12} height={12} viewBox="0 0 16 16" fill="currentColor">
                          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                        </svg>
                      </a>
                    )}
                  </td>
                  <td className="description-cell">
                    <span className="description-text">{project.description}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedProject.name}</h2>
                <span className="modal-category" data-category={selectedProject.category}>
                  {selectedProject.category}
                </span>
              </div>
              <button
                className="close-button"
                onClick={() => setSelectedProject(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-description">{selectedProject.description}</p>
              {selectedProject.goals && selectedProject.goals.length > 0 && (
                <div className="modal-goals">
                  <h4>Goals</h4>
                  <ul>
                    {selectedProject.goals.map((goal, i) => (
                      <li key={i}>{goal}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedProject.repo && (
                <a
                  href={`https://github.com/lastweek/${selectedProject.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="modal-repo-link"
                >
                  <svg width={20} height={20} viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                  </svg>
                  View on GitHub
                  <span>↗</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
