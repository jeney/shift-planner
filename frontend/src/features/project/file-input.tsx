import { forwardRef } from 'react'

import { PROJECT_FILE_EXTENSION } from '@/project/file'

interface ProjectFileInputProps {
  onFile: (file: File) => void
}

/** Hidden file input for opening a saved project. Trigger it with `ref.current.click()`. */
export const ProjectFileInput = forwardRef<HTMLInputElement, ProjectFileInputProps>(
  function ProjectFileInput({ onFile }, ref) {
    return (
      <input
        ref={ref}
        type="file"
        accept={`${PROJECT_FILE_EXTENSION},.json,application/json`}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="project-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onFile(file)
        }}
      />
    )
  },
)
