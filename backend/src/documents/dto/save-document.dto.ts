import { EditorDocumentDto } from '../../common/dto/document.dto';

/**
 * Request body for saving a document (create or update).
 * Document shape is compatible with engine model.
 */
export class SaveDocumentDto {
  document!: EditorDocumentDto;
}
