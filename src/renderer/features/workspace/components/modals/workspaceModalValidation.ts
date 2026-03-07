export const isValidWorkspaceTitle = (title: string): boolean => title.trim().length > 0;

export const isValidWorkspaceDescription = (description: string): boolean =>
    description.length === 0 || description.trim().length > 0;

export const isValidProjectTitle = isValidWorkspaceTitle;
export const isValidProjectDescription = isValidWorkspaceDescription;
