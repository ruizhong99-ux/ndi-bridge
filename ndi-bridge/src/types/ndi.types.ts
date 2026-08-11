import ref from "ref-napi";
import StructFactory from "ref-struct-di";

export const NDI_FOURCC_RGBA = 0x41424752; // 'RGBA' in NDI's little-endian FourCC.
export const NDI_FRAME_FORMAT_PROGRESSIVE = 1;

export type NDIHandle = Buffer;

const VoidPtr = ref.refType(ref.types.void);
const BytePtr = ref.refType(ref.types.uint8);
const StructType = StructFactory(ref);

// NDIlib_video_frame_v2_t from Processing.NDI.Lib.h.
export const NDIlib_video_frame_v2_t = StructType({
  xres: ref.types.int32,
  yres: ref.types.int32,
  fourCC: ref.types.int32,
  frame_rate_N: ref.types.int32,
  frame_rate_D: ref.types.int32,
  picture_aspect_ratio: ref.types.float,
  frame_format_type: ref.types.int32,
  timecode: ref.types.int64,
  p_data: BytePtr,
  line_stride_in_bytes: ref.types.int32,
  p_metadata: ref.types.CString,
  timestamp: ref.types.int64
});

export const NDIlib_send_create_t = StructType({
  p_ndi_name: ref.types.CString,
  p_groups: ref.types.CString,
  clock_video: ref.types.uint8,
  clock_audio: ref.types.uint8
});

export type NDIFrame = InstanceType<typeof NDIlib_video_frame_v2_t>;
