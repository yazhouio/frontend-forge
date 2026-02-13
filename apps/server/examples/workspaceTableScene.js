export const WorkspaceTableScene = {
    meta: {
        id: "workspace-crd-table",
        name: "Workspace CRD Table",
        title: "Workspace CRD Table",
        path: "/workspace-crd-table",
    },
    crd: {
        apiVersion: "v1alpha1",
        kind: "Demo",
        plural: "jsbundles",
        group: "extensions.kubesphere.io",
        kapi: true,
    },
    scope: "namespace",
    page: {
        id: "workspace-forge-preview-table",
        title: "Table Preview",
        authKey: "jobs",
    },
    columns: [
        {
            key: "name",
            title: "NAME",
            render: {
                type: "text",
                path: "metadata.name",
            },
        },
        {
            key: "project",
            title: "Project",
            enableHiding: true,
            render: {
                type: "text",
                path: `metadata.annotations["meta.helm.sh/release-namespace"]`,
            },
        },
        {
            key: "updatedAt",
            title: "UPDATED_AT",
            enableHiding: true,
            render: {
                type: "time",
                path: "metadata.creationTimestamp",
                format: "local-datetime",
            },
        },
    ],
};
