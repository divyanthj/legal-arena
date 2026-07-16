"use client";

import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { Fragment } from "react";

const Modal = ({ isModalOpen, setIsModalOpen, title = "Legal Arena", eyebrow = "Case desk", children, footer }) => (
  <Transition appear show={isModalOpen} as={Fragment}>
    <Dialog as="div" className="relative z-50 text-white" onClose={() => setIsModalOpen(false)}>
      <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md" />
      </Transition.Child>
      <div className="fixed inset-0 overflow-y-auto p-3 sm:p-6">
        <div className="flex min-h-full items-end justify-center sm:items-center">
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="translate-y-6 opacity-0 scale-[0.98]" enterTo="translate-y-0 opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="translate-y-0 opacity-100 scale-100" leaveTo="translate-y-6 opacity-0 scale-[0.98]">
            <Dialog.Panel className="arena-glass w-full max-w-3xl overflow-hidden rounded-t-[2rem] shadow-2xl shadow-black/70 sm:rounded-[2rem]">
              <header className="flex items-start justify-between gap-6 border-b border-white/10 px-6 py-5 sm:px-8 sm:py-6">
                <div><p className="arena-kicker">{eyebrow}</p><Dialog.Title as="h2" className="mt-2 text-2xl font-semibold tracking-tight text-white">{title}</Dialog.Title></div>
                <button type="button" className="arena-modal-close btn btn-circle btn-ghost btn-sm border border-white/10 text-white/70 hover:border-white/20 hover:bg-white/10 hover:text-white" onClick={() => setIsModalOpen(false)} aria-label="Close modal"><XMarkIcon className="h-5 w-5" /></button>
              </header>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-6 text-white/70 sm:px-8">{children}</div>
              {footer ? <footer className="flex flex-wrap justify-end gap-3 border-t border-white/10 bg-black/20 px-6 py-5 sm:px-8">{footer}</footer> : null}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </Dialog>
  </Transition>
);

export default Modal;
