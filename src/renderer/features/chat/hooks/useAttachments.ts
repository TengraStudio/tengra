import { useState } from 'react'

import { generateId } from '@/lib/utils'
import { Attachment } from '@/types'

export const useAttachments = () => {
    const [attachments, setAttachments] = useState<Attachment[]>([])

    const processFile = async (file: File) => {
        const id = generateId()
        const newAttachment: Attachment = {
            id,
            name: file.name,
            type: file.type.split('/')[0] as 'image' | 'file',
            size: file.size,
            status: 'uploading'
        }
        setAttachments(prev => [...prev, newAttachment])

        try {
            const content = await file.text()
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'ready', content } : a))
        } catch {
            setAttachments(prev => prev.map(a => a.id === id ? { ...a, status: 'error' } : a))
        }
    }

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index))
    }

    return {
        attachments,
        setAttachments,
        processFile,
        removeAttachment
    }
}
