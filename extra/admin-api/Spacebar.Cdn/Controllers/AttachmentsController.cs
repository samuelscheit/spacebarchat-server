using ArcaneLibs.Extensions.Streams;
using Microsoft.AspNetCore.Mvc;
using Spacebar.Cdn.Services;
using Spacebar.Interop.Cdn.Abstractions;

namespace Spacebar.Cdn.Controllers;

[ApiController]
public class AttachmentsController(IFileSource fs, CdnAttachmentAccessService accessService) : ControllerBase {
    [HttpGet("/attachments/{channelId:required}/{messageId:required}/{filename:required}")]
    public async Task<IActionResult> GetAttachment(string channelId, string messageId, string filename) {
        return await GetAttachmentFile($"attachments/{channelId}/{messageId}/{filename}", filename);
    }

    [HttpGet("/ephemeral-attachments/{applicationId:required}/{attachmentId:required}/{filename:required}")]
    public async Task<IActionResult> GetEphemeralAttachment(string applicationId, string attachmentId, string filename) {
        return await GetAttachmentFile($"ephemeral-attachments/{applicationId}/{attachmentId}/{filename}", filename);
    }

    private async Task<IActionResult> GetAttachmentFile(string path, string filename) {
        if (!accessService.HasAccess(Request, Request.Path)) {
            return NotFound("This content is no longer available.");
        }

        await using var file = await fs.GetFile(path);
        return new FileContentResult(file.Stream.ReadToEnd().ToArray(), AttachmentContentType.FromFilename(filename));
    }
}
