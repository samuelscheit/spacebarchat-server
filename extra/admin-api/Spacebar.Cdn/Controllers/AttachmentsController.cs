using Microsoft.AspNetCore.Mvc;
using Spacebar.Cdn.Services;
using Spacebar.Interop.Cdn.Abstractions;

namespace Spacebar.Cdn.Controllers;

[ApiController]
public class AttachmentsController(IFileSource fs, CdnAttachmentAccessService accessService) : ControllerBase {
    [HttpGet("/attachments/{channelId:required}/{messageId:required}/{filename:required}")]
    public async Task<IActionResult> GetAttachment(string channelId, string messageId, string filename) {
        if (!AttachmentPath.TryBuildAttachment(channelId, messageId, filename, out var path)) {
            return BadRequest("Invalid attachment path.");
        }

        return await GetAttachmentFile(path, filename);
    }

    [HttpGet("/ephemeral-attachments/{applicationId:required}/{attachmentId:required}/{filename:required}")]
    public async Task<IActionResult> GetEphemeralAttachment(string applicationId, string attachmentId, string filename) {
        if (!AttachmentPath.TryBuildEphemeralAttachment(applicationId, attachmentId, filename, out var path)) {
            return BadRequest("Invalid attachment path.");
        }

        return await GetAttachmentFile(path, filename);
    }

    private async Task<IActionResult> GetAttachmentFile(string path, string filename) {
        if (!accessService.HasAccess(Request, Request.Path)) {
            return NotFound("This content is no longer available.");
        }

        var file = await fs.GetFile(path);
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        return File(file.Stream, AttachmentContentType.FromFilename(filename));
    }
}
