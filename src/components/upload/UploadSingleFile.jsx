import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDropzone } from 'react-dropzone';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import Image from 'next/image';

const UploadSingleFile = ({ file, setFile, model }) => {
  const [loading, setLoading] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: handleDrop
  });
  async function handleDrop(acceptedFiles) {
    if (acceptedFiles.length > 1) {
      Swal.fire('Failed to upload image', 'You can only upload one image at a time.', 'error');
      return; // Early return to prevent further execution
    }

    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('model', model);

    setLoading(true);
    try {
      const data = await api.uploadImage(formData, {
        onUploadProgress: (progressEvent) => {
          const { loaded, total } = progressEvent;
          const percentage = Math.floor((loaded * 100) / total);
          setLoading(percentage);
        }
      });
      setFile({ id: data.id, path: data.path });
    } catch (error) {
      Swal.fire('Failed to upload image', error.message || 'An error occurred during upload.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className="cursor-pointer border-2 border-dashed border-gray-300 rounded-md p-2 text-center"
      >
        <input {...getInputProps()} />
        {loading ? (
          <p>Uploading... {loading}%</p>
        ) : file ? (
          <p>Change image</p>
        ) : (
          <p>Drag and drop file here, or click to select file</p>
        )}
      </div>

      {file && (
        <div className="relative border-2 border-gray-400  pt-[100%] mt-2">
          <Image fill className="object-cover" alt="file preview" src={file.path || file} />

          <p
            onClick={() => setFile('')}
            className=" absolute top-2 right-2 text-red-500 text-sm border rounded-md px-1 bg-black font-extrabold cursor-pointer"
          >
            X
          </p>
        </div>
      )}
    </div>
  );
};

UploadSingleFile.propTypes = {
  file: PropTypes.object,
  setFile: PropTypes.func.isRequired
};

export default UploadSingleFile;
