'use client';
import * as Yup from 'yup';
import { useState } from 'react';
import { useMutation } from 'react-query';
import RouterLink from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next-nprogress-bar';
import { useFormik, Form, FormikProvider } from 'formik';
import useAdminUserStore from 'src/stores/userStore';
import * as api from 'src/services';
import { MdOutlineVisibility, MdLock, MdOutlineVisibilityOff } from 'react-icons/md';
import { IoMdMail } from 'react-icons/io';
import Swal from 'sweetalert2';

export default function LoginForm() {
  const { push } = useRouter();
  const storeLogin = useAdminUserStore((s) => s.login);
  const searchParam = useSearchParams();
  const redirect = searchParam.get('redirect');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { mutate } = useMutation(api.login, {
    onSuccess: async (data) => {
      storeLogin(data.user);
      setLoading(false);
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Logged in successfully!',
        showConfirmButton: false,
        timer: 1500,
        background: '#f0f4f8',
        iconColor: '#4CAF50'
      });
      push(redirect || '/');
    },
    onError: (err) => {
      setLoading(false);
      Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: err.response.data.message || 'Something went wrong!',
        confirmButtonColor: '#d33'
      });
    }
  });

  const LoginSchema = Yup.object().shape({
    email: Yup.string().email('Enter a valid email').required('Email is required.'),
    password: Yup.string().required('Password is required.').min(8, 'Password should be 8 characters or longer.')
  });

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
      remember: true
    },
    validationSchema: LoginSchema,
    onSubmit: async (values) => {
      const { email, password } = values;
      setLoading(true);
      mutate({ email, password });
    }
  });

  const { errors, touched, values, handleSubmit, getFieldProps } = formik;

  return (
    <div className="w-full bg-white ">
      <FormikProvider value={formik}>
        <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <div className="relative">
              <IoMdMail className="absolute left-3 top-3 text-gray-500" />
              <input
                id="email"
                type="email"
                {...getFieldProps('email')}
                className={`block w-full border rounded-md py-2 pl-10 pr-3 focus:outline-none focus:ring ${
                  touched.email && errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your email"
              />
              {touched.email && errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <MdLock className="absolute left-3 top-3 text-gray-500" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...getFieldProps('password')}
                className={`block w-full border rounded-md py-2 pl-10 pr-3 focus:outline-none focus:ring ${
                  touched.password && errors.password ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter your password"
              />
              <button type="button" className="absolute right-3 top-3" onClick={() => setShowPassword((prev) => !prev)}>
                {showPassword ? <MdOutlineVisibility /> : <MdOutlineVisibilityOff />}
              </button>
              {touched.password && errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <label className="flex items-center">
              <input type="checkbox" {...getFieldProps('remember')} className="mr-2" checked={values.remember} />
              Remember me
            </label>
          </div>

          <button
            type="submit"
            className={`w-full bg-[var(--brand)] text-white py-2 rounded-md focus:outline-none ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-95'
            }`}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Login'}
          </button>
        </Form>
      </FormikProvider>
    </div>
  );
}
