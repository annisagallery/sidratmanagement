import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { useDropzone } from 'react-dropzone';
import Swal from 'sweetalert2';
import * as api from 'src/services';
import Image from 'next/image';

const UploadMultiFile = ({ files, setFiles, model }) => {
  const [loading, setLoading] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: 'image/*',
    onDrop: handleDrop
  });

  async function handleDrop(acceptedFiles) {
    const newFiles = [];

    setLoading(true);
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', model);

        const data = await api.uploadImage(formData, {
          onUploadProgress: (progressEvent) => {
            const { loaded, total } = progressEvent;
            const percentage = Math.floor((loaded * 100) / total);
            setLoading(percentage);
          }
        });

        newFiles.push({ id: data.id, path: data.path });
      }
      setFiles([...files, ...newFiles]);
    } catch (error) {
      Swal.fire('Failed to upload image', '', 'error');
      console.log(error);
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveFile(fileId) {
    setFiles(files.filter((file) => file.id !== fileId));
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className="cursor-pointer border-2 border-dashed border-gray-300 rounded-md p-2 text-center"
      >
        <input {...getInputProps()} />
        {loading ? <p>Uploading... {loading}%</p> : <p>Drag and drop files here, or click to select files</p>}
      </div>

      <div className="grid grid-cols-6 gap-4 mt-2">
        {files.map((file, index) => (
          <div key={index} className="relative border-2 border-gray-400 pt-[100%]">
            <Image fill className="object-cover" alt="file preview" src={file.path} />

            <p
              onClick={() => handleRemoveFile(file.id)}
              className="absolute top-2 right-2 text-red-500 text-sm border rounded-md px-1 bg-black font-extrabold cursor-pointer"
            >
              X
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

UploadMultiFile.propTypes = {
  files: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      url: PropTypes.string.isRequired
    })
  ),
  setFiles: PropTypes.func.isRequired,
  model: PropTypes.string.isRequired
};

export default UploadMultiFile;
