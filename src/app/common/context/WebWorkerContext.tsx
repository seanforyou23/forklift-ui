import * as React from 'react';

interface IWorkerContext {
  isWorkerEnabled: boolean;
  worker?: Worker | undefined
}

export const WorkerContext = React.createContext<IWorkerContext>({
  isWorkerEnabled: true,
  worker: undefined
});

interface IWorkerContextProviderProps {
  children: React.ReactNode;
}

export const WorkerContextProvider: React.FunctionComponent<IWorkerContextProviderProps> = ({
  children,
}: IWorkerContextProviderProps) => {
  const [isWorkerEnabled, setIsWorkerEnabled] = React.useState(true);

  const [worker] = React.useState(window.Worker ? new Worker(new URL('../../Plans/components/Wizard/vms.worker.js', import.meta.url)) : undefined);

  React.useEffect(() => {

    worker?.addEventListener('message', (e) => {
      console.log('data indexed via worker: ', e.data);
    })

    return () => {
      worker?.removeEventListener('message', () => { });
    }

  }, []);

  return (
    <WorkerContext.Provider
      value={{
        isWorkerEnabled,
        worker
      }}
    >
      {children}
    </WorkerContext.Provider>
  );
};

export const useWorkerContext = (): IWorkerContext => React.useContext(WorkerContext);
