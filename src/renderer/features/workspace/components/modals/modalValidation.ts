export const isValidProjectTitle = (title: string): boolean => title.trim().length > 0;

export const isValidProjectDescription = (description: string): boolean =>
    description.length === 0 || description.trim().length > 0;
